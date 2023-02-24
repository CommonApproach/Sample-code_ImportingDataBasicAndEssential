
const {GDBGroupModel} = require("../models/group");
const {GraphDB} = require("../utils/graphdb");
const {SPARQL} = require('../utils/graphdb/helpers');
const {GDBOrganizationModel} = require("../models/organization");

/**
 * the function takes a graphdb object or URI and check if it is in the list,
 * add it in if it is not in the list,
 * ignore it if it is in the list
 * the object's type must be same with previous object's type in the list
 * @param list
 * @param object
 */
function addObjectToList(list, object) {
  if (typeof object === 'string') {
    // the object is a URI
    if (!list.includes(object))
      list.push(object);
  } else {
    // the object is a Graphdb object
    const result = list.filter(previousObject => {
      return previousObject._id === object._id;
    });
    if (result.length === 0)
      list.push(object);
  }
}

function URI2Id(uri) {
  return uri.split('_')[1];
}

/**
 * the function checks weather the user is serving for the organization as a specific role
 * @param userAccount user's userAccount
 * @param organizationId organization's id
 * @param role role of the user, ex. 'administratorOfs'
 */
function organizationBelongsToUser(userAccount, organizationId, role) {
  const checkerList = userAccount[role].filter(organizationURL =>
    organizationURL.split('_')[1] === organizationId
  );
  return checkerList.length > 0;
}

/**
 * check weather an organization with organizationid belongs to any group owned by the group admin
 * @param userAccount groupAdmin's account
 * @param organizationId the _id of the organization
 * @returns {Promise<boolean>}
 */
async function organizationBelongsToGroupAdmin(userAccount, organizationId) {
  // fetch all groups belong to the user
  const groups = await Promise.all(userAccount.groupAdminOfs.map(groupURI => {
      return GDBGroupModel.findOne({_id: groupURI.split('_')[1]}, {populates: ['organizations']});
    }
  ));
  // check does there any group contain the organization with organizationId
  const checker = groups.filter(group => {
    return group.organizations.includes(`:organization_${organizationId}`);
  });
  if (checker.length > 0)
    return true;
  return false;
}

/**
 * if role is provided, the function gives all organizations' URIs which are in the same groups
 * with organizations this user servers for as a specific role
 * if role is not provided, the function gives all organizations' URIs which are in the same groups
 * with organizations this user servers for
 * @param userAccount the userAccount
 * @param role role of the user, ex. 'administratorOfs'
 * @param organizations should be an empty list
 * @returns {Promise<*[]>}
 */
const organizationsInSameGroups = async (userAccount, organizations, role) => {
    if (role) {
      await Promise.all(userAccount[role].map(organizationURI => {
        const organizationId = organizationURI.split('_')[1];
        const query = `
        PREFIX : <http://ontology.eil.utoronto.ca/cids/cidsrep#>
        select * where { 
	          ?group :hasOrganization :organization_${organizationId}.
    	      ?group :hasOrganization ?organization.
        }`;
        return GraphDB.sendSelectQuery(query, false, (res) => {
          const organizationURI = SPARQL.getPrefixedURI(res.organization.id);
          if (organizationURI.split('_')[1] !== organizationId && !organizations.includes(organizationURI))
            organizations.push(organizationURI);
        });
      }));
    } else {
      await Promise.all(userAccount.associatedOrganizations.map(organizationURI => {
        const organizationId = organizationURI.split('_')[1];
        const query = `
        PREFIX : <http://ontology.eil.utoronto.ca/cids/cidsrep#>
        select * where { 
	          ?group :hasOrganization :organization_${organizationId}.
    	      ?group :hasOrganization ?organization.
        }`;
        return GraphDB.sendSelectQuery(query, false, (res) => {
          const organizationURI = SPARQL.getPrefixedURI(res.organization.id);
          if (organizationURI.split('_')[1] !== organizationId && !organizations.includes(organizationURI))
            organizations.push(organizationURI);
        });
      }));
    }


  }
;


/**
 * If the role is provided, the function will return true if the user serves as a specific role for
 * the organization(associated with organizationId) or for an organization
 * which is in a same group with the organization(associated with organizationId)
 * If the role is not provided, the function will return true if the user serves for
 * the organization(associated with organizationId) or for an organization
 * which is in a same group with the organization(associated with organizationId)
 * @param organizationId the id of the organization
 * @param userAccount user's account
 * @param role role of the user, ex. 'administratorOfs'
 * @returns {Promise<boolean>}
 */
const isAPartnerOrganization = async (organizationId, userAccount, role) => {
  if (role) {// return true if the user is one of the role user of the organization
    if (userAccount[role].includes(`:organization_${organizationId}`))
      return true;
    // fetch all organizations associated with each organizations in userAccount[role]
    const allOrganizations = [];
    await organizationsInSameGroups(userAccount, allOrganizations, role);
    if (allOrganizations.includes(`:organization_${organizationId}`))
      return true;
    return false;
  } else {
    // return true if the user is one of the sponsored user of the organization
    if (userAccount.associatedOrganizations.includes(`:organization_${organizationId}`))
      return true;
    const allOrganizations = [];
    await organizationsInSameGroups(userAccount, allOrganizations);
    if (allOrganizations.includes(`:organization_${organizationId}`))
      return true;
    return false;
  }
};

/**
 * return true if the resource belongs to an organization either which the user serves as a role, or
 * is a partner of the user. Please check the definition of the 'partner organization' in the description
 * of isAPartnerOrganization
 * @param resource the resource's object
 * @param userAccount the user account
 * @param role the role, ex. 'administratorOfs'
 * @returns {Promise<boolean>}
 */
async function isReachableBy(resource, userAccount, role) {

  for (const organizationURI of resource.forOrganizations) {
    if (await isAPartnerOrganization(organizationURI.split('_')[1], userAccount, role)) {
      // if any organization which associated with the indicator is a partner organization of the indicator
      // pass
      return true;
    }
  }
}

async function allReachableOrganizations(userAccount) {

  let organizations = [];
  if (userAccount.groupAdminOfs?.length) {
    // add all organization is his group in to the list
    // fetch all groups belongs to him
    const groups = await GDBGroupModel.find({administrator: {_id: userAccount._id}}, {populates: ['organizations.administrator.person']});
    groups.map(group => {
      group.organizations.map(organization => {
        // fetch all reachable organizations and add them in
        addObjectToList(organizations, organization);
      });
    });
  }
  // add organizations which the user associated with to the list
  (await Promise.all(userAccount.associatedOrganizations.map(orgURI => {
    return GDBOrganizationModel.findOne({_id: orgURI.split('_')[1]}, {populates: ['administrator.person']})
  }))).map(org => {
    addObjectToList(organizations, org)
  })
  // also add organizations which is same groups to the list
  let orgsInSameGroups = [];
  await organizationsInSameGroups(userAccount, orgsInSameGroups);
  orgsInSameGroups = await Promise.all(orgsInSameGroups.map(orgURI => {
    return GDBOrganizationModel.findOne({_id: orgURI.split('_')[1]}, {populates: ['administrator.person']});
  }));
  orgsInSameGroups.map(org => {
    addObjectToList(organizations, org)
  });
  return organizations;
}




module.exports = {URI2Id, organizationsInSameGroups, addObjectToList, allReachableOrganizations,
  organizationBelongsToUser, organizationBelongsToGroupAdmin, isReachableBy, isAPartnerOrganization};