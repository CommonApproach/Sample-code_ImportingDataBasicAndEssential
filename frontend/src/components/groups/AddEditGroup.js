import {makeStyles} from "@mui/styles";
import {useNavigate, useParams} from "react-router-dom";
import React, {useEffect, useState, useContext} from "react";
import {Loading} from "../shared";
import {Button, Container, Paper, Typography} from "@mui/material";
import GeneralField from "../shared/fields/GeneralField";
import LoadingButton from "../shared/LoadingButton";
import {AlertDialog} from "../shared/Dialogs";
import {fetchOrganizations} from "../../api/organizationApi";
import {useSnackbar} from "notistack";
import {fetchUsers} from "../../api/userApi";
import Dropdown from "../shared/fields/MultiSelectField";
import SelectField from "../shared/fields/SelectField";
import {createGroup, fetchGroup, updateGroup} from "../../api/groupApi";
import {UserContext} from "../../context";
import {reportErrorToBackend} from "../../api/errorReportApi";

const useStyles = makeStyles(() => ({
  root: {
    width: '80%'
  },
  button: {
    marginTop: 12,
    marginBottom: 0,
    length: 100
  },
}));


export default function AddEditGroup() {

  const classes = useStyles();
  const navigate = useNavigate();
  const {id} = useParams();
  const mode = id ? 'edit' : 'new';
  const {enqueueSnackbar} = useSnackbar();
  const userContext = useContext(UserContext);

  const [state, setState] = useState({
    submitDialog: false,
    loadingButton: false,
  });
  const [errors, setErrors] = useState(
    {}
  );

  const [form, setForm] = useState({
    label: '',
    administrator: '',
    organizations: [],
    comment: '',
  });
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState({
    organizations: {},
    administrators: {},
  });

  useEffect(() => {
    if(!userContext.isSuperuser && !userContext.groupAdminOf.length > 0){
      navigate('/groups');
      enqueueSnackbar('Wrong auth', {variant: 'error'})
    }
    Promise.all([
      fetchOrganizations()
        .then(({organizations}) => {
        organizations.map(organization => {
          options.organizations[organization._id] = organization.legalName;
        })
      }).catch(e => {
        if (e.json)
          setErrors(e.json);
        reportErrorToBackend(e)
        setLoading(false);
        enqueueSnackbar(e.json?.message || "Error occurs when fetching organizations", {variant: 'error'});
      }),
      fetchUsers().then(({data}) => {
        data.map((user) => {
          options.administrators[user._id] = `${user.person.familyName} ${user.person.givenName} ID: ${user._id}`;
        })
      }).catch(e => {
        if (e.json)
          setErrors(e.json);
        reportErrorToBackend(e)
        setLoading(false);
        enqueueSnackbar(e.json?.message || "Error occurs when fetching users", {variant: 'error'});
      }),
    ]).then(() => {
      if (mode === 'edit' && id) {
        fetchGroup(id,).then(res => {
          if (res.success) {
            const group = res.group;
            setForm({
              label: group.label || '',
              administrator: group.administrator || '',
              comment: group.comment || '',
              organizations: group.organizations || []
            });
            setLoading(false);
          }
        }).catch(e => {
          if (e.json)
            setErrors(e.json);
          reportErrorToBackend(e)
          setLoading(false);
          enqueueSnackbar(e.json?.message || "Error occurs when fetching group", {variant: 'error'});
        });
      } else if (mode === 'edit' && !id) {
        navigate('/groups');
        enqueueSnackbar("No ID provided", {variant: 'error'});
      } else if (mode === 'new') {
        setLoading(false);
      }
    }).catch(e => {
      if (e.json)
        setErrors(e.json);
      reportErrorToBackend(e)
      setLoading(false);
      enqueueSnackbar(e.json?.message || "Error occur", {variant: 'error'});
    });


  }, [mode]);

  const handleSubmit = () => {
    if (validate()) {
      setState(state => ({...state, submitDialog: true}));
    }
  };

  const handleConfirm = () => {
    setState(state => ({...state, loadingButton: true}));
    if (mode === 'new') {
      createGroup(form).then((ret) => {
        if (ret.success) {
          setState({loadingButton: false, submitDialog: false,});
          navigate('/groups');
          enqueueSnackbar(ret.message || 'Success', {variant: "success"});
        }

      }).catch(e => {
        if (e.json) {
          setErrors(e.json);
        }
        reportErrorToBackend(e);
        enqueueSnackbar(e.json?.message || 'Error occurs when creating organization', {variant: "error"});
        setState({loadingButton: false, submitDialog: false,});
      });
    } else if (mode === 'edit') {
      updateGroup(id, form).then((res) => {
        if (res.success) {
          setState({loadingButton: false, submitDialog: false,});
          navigate('/groups');
          enqueueSnackbar(res.message || 'Success', {variant: "success"});
        }
      }).catch(e => {
        if (e.json) {
          setErrors(e.json);
        }
        reportErrorToBackend(e)
        enqueueSnackbar(e.json?.message || 'Error occurs when updating group', {variant: "error"});
        setState({loadingButton: false, submitDialog: false,});
      });
    }

  };

  const validate = () => {
    const error = {};
    if (form.label === '') {
      error.label = 'The field cannot be empty';
    }
    if (!form.administrator)
      error.administrator = 'The field cannot be empty'


    setErrors(error);
    return Object.keys(error).length === 0;
  };

  if (loading)
    return <Loading/>;

  return (
    <Container maxWidth="md">
      <Paper sx={{p: 2}} variant={'outlined'}>
        <Typography variant={'h4'}> Group </Typography>
        <GeneralField
          key={'label'}
          label={'Label'}
          value={form.label}
          required
          disabled={!userContext.isSuperuser}
          sx={{mt: '16px', minWidth: 350}}
          onChange={e => form.label = e.target.value}
          error={!!errors.label}
          helperText={errors.label}
          onBlur={() => {
            if (form.label === '') {
              setErrors(errors => ({...errors, label: 'This field cannot be empty'}));
            } else {
              setErrors(errors => ({...errors, label: ''}));
            }

          }}
        />
          <SelectField
          key={'administrator'}
          disabled={!userContext.isSuperuser}
          label={'Group Administrator'}
          value={form.administrator}
          options={options.administrators}
          error={!!errors.administrator}
          helperText={errors.administrator}
          onChange={e => {
            setForm(form => ({
                ...form, administrator: e.target.value
              })
            );
          }}
        />

        <Dropdown
          label="Organizations"
          key={'organizations'}
          value={form.organizations}
          onChange={e => {
            form.organizations = e.target.value;
          }}
          options={options.organizations}
          error={!!errors.organizations}
          helperText={errors.organizations}
          // sx={{mb: 2}}
        />
        <GeneralField
          key={'comment'}
          label={'Comment'}
          value={form.comment}
          sx={{mt: '16px', minWidth: 350}}
          onChange={e => form.comment = e.target.value}
          error={!!errors.comment}
          helperText={errors.comment}
        />

        <Button variant="contained" color="primary" className={classes.button} onClick={handleSubmit}>
          Submit
        </Button>

        <AlertDialog dialogContentText={"You won't be able to edit the information after clicking CONFIRM."}
                     dialogTitle={mode === 'new' ? 'Are you sure you want to create this new Organization?' :
                       'Are you sure you want to update this Organization?'}
                     buttons={[<Button onClick={() => setState(state => ({...state, submitDialog: false}))}
                                       key={'cancel'}>{'cancel'}</Button>,
                       <LoadingButton noDefaultStyle variant="text" color="primary" loading={state.loadingButton}
                                      key={'confirm'}
                                      onClick={handleConfirm} children="confirm" autoFocus/>]}
                     open={state.submitDialog}/>
      </Paper>
    </Container>);

}