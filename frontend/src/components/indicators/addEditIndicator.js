import {makeStyles} from "@mui/styles";
import {useNavigate, useParams} from "react-router-dom";
import React, {useEffect, useState, useContext} from "react";
import {Loading} from "../shared";
import {Button, Container, Paper, Typography} from "@mui/material";
import GeneralField from "../shared/fields/GeneralField";
import LoadingButton from "../shared/LoadingButton";
import {AlertDialog} from "../shared/Dialogs";
import {fetchOrganizations, } from "../../api/organizationApi";
import {useSnackbar} from "notistack";
import {createGroup, fetchGroup, updateGroup} from "../../api/groupApi";
import {UserContext} from "../../context";
import {createIndicator, fetchIndicator, updateIndicator} from "../../api/indicatorApi";
import IndicatorField from "../shared/indicatorField";
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


export default function AddEditIndicator() {

  const classes = useStyles();
  const navigate = useNavigate();
  const {id, orgId, operationMode} = useParams();
  const mode = id? operationMode : 'new';
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
    name: '',
    description: '',
    organizations:[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if((mode === 'edit' && id) || (mode === 'view' && id)){
      fetchIndicator(id, userContext).then(({success, indicator}) => {
        if(success){
          setForm(indicator);
          setLoading(false)
        }
      }).catch(e => {
        if (e.json)
          setErrors(e.json);
        reportErrorToBackend(e)
        setLoading(false);
        enqueueSnackbar(e.json?.message || "Error occur", {variant: 'error'});
      });
    } else if(mode === 'edit' && (!id || !orgId) ) {
      navigate('/organization-indicators');
      enqueueSnackbar("No ID or orgId provided", {variant: 'error'});
    } else if (mode === 'new' && !orgId){
      setLoading(false);
      // navigate('/organization-indicators');
      // enqueueSnackbar("No orgId provided", {variant: 'error'});
    }else if (mode === 'new' && orgId) {
      setForm(form => ({...form, organizations: [orgId]}))
      setLoading(false);
    } else {
      navigate('/organization-indicators');
      enqueueSnackbar('Wrong auth', {variant: 'error'})
    }

  }, [mode, id]);

  const handleSubmit = () => {
    if (validate()) {
      setState(state => ({...state, submitDialog: true}));
    }
  };

  const handleConfirm = () => {
    setState(state => ({...state, loadingButton: true}));
    if (mode === 'new') {
      createIndicator({form}, userContext).then((ret) => {
        if (ret.success) {
          setState({loadingButton: false, submitDialog: false,});
          navigate('/organization-indicators');
          enqueueSnackbar(ret.message || 'Success', {variant: "success"});
        }
      }).catch(e => {
        if (e.json) {
          setErrors(e.json);
        }
        console.log(e)
        reportErrorToBackend(e)
        enqueueSnackbar(e.json?.message || 'Error occurs when creating organization', {variant: "error"});
        setState({loadingButton: false, submitDialog: false,});
      });
    } else if (mode === 'edit' && id) {
      updateIndicator({form}, id).then((res) => {
        if (res.success) {
          setState({loadingButton: false, submitDialog: false,});
          navigate('/organization-indicators');
          enqueueSnackbar(res.message || 'Success', {variant: "success"});
        }
      }).catch(e => {
        if (e.json) {
          setErrors(e.json);
        }
        reportErrorToBackend(e)
        enqueueSnackbar(e.json?.message || 'Error occurs when updating indicator', {variant: "error"});
        setState({loadingButton: false, submitDialog: false,});
      });
    }

  };

  const validate = () => {
    const error = {};
    if (form.name === '')
      error.name = 'The field cannot be empty';

    if (!form.description)
      error.description = 'The field cannot be empty'
    if(form.organizations.length === 0)
      error.organizations = 'The field cannot be empty'
    setErrors(error);
    return Object.keys(error).length === 0;
  };

  if (loading)
    return <Loading/>;

  return (
    <Container maxWidth="md">
      <Paper sx={{p: 2}} variant={'outlined'}>
        <Typography variant={'h4'}> Indicator </Typography>
        <IndicatorField
          disabled={mode === 'view'}
          disabledOrganization={!!orgId}
          defaultValue={form}
          required
          onChange={(state) => {
            setForm(form => ({...form, ...state}));
          }}
          importErrors={errors}
        />

        {mode==='view'?
          <div/>:
          <Button variant="contained" color="primary" className={classes.button} onClick={handleSubmit}>
          Submit
        </Button>}

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