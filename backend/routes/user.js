const express = require('express');
const {inviteNewUserHandler} = require("../services/users/invite");
const {superuserUpdateUserById, fetchUserHandler, updateUserHandler} = require("../services/user/user");
const {superuserDeleteUser} = require("../services/users/users");
const {regularUserSuperuserUpdateProfile, fetchProfileHandler, updateProfileHandler} = require("../services/profile/profile");

const router = express.Router({mergeParams: true});


router.get('/:id', fetchUserHandler);
router.post('/invite', inviteNewUserHandler);
router.post('/updateUser/:id', updateUserHandler)
router.get('/profile/:id', fetchProfileHandler)
router.post('/profile/:id', updateProfileHandler)

module.exports = router;