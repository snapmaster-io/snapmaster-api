// action API handlers
// 
// exports:
//   createHandlers(app): create handlers for GET and POST endpoints

const requesthandler = require('../modules/requesthandler');
const actiondal = require('./actiondal');

exports.createHandlers = (app) => {
  // Get actions API endpoint
  /**
   * @swagger
   * /actions:
   *    get:
   *      summary: Return all of the user's actions
   *      description: Return all of the user's actions as an array
   *      responses: 
   *        200:
   *          description: Success
   *          content: 
   *            application/json: 
   *              schema: 
   *                title: actions
   *                type: array
   *                items: 
   *                  title: action
   *                  type: object
   *                  properties: 
   *                    name: 
   *                      type: string
   *                    description: 
   *                      type: string
   *                    actions: 
   *                      type: array
   *                      items: 
   *                        type: object
   *                        properties: 
   *                          name: 
   *                            type: string
   *                          description: 
   *                            type: string
   *                          required: 
   *                            type: boolean
   *                    actionId: 
   *                      type: string
   *                    text: 
   *                      type: string
   *                    userId: 
   *                      type: string
   *                    account: 
   *                      type: string
   *                    private: 
   *                      type: boolean
   *        401:
   *          description: Unauthorized
   */  
  app.get('/actions', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const returnActions = async () => {
      const actions = await actiondal.getActions(req.userId) || {};
      res.status(200).send(actions);
    }
    returnActions();
  });
    
  // Get action API endpoint
  app.get('/actions/:account/:actionName', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const account = req.params.account;
    const actionName = req.params.actionName;
    if (!account || !actionName) {
      res.status(200).send({ message: 'error'});
      return;
    }

    const returnAction = async () => {
      const action = await actiondal.getAction(`${account}/${actionName}`);
      res.status(200).send(action);
    }
    returnAction();
  });
    
  // Post actions API endpoint
  // this will create a new action, fork, or delete an existing action with actionId
  app.post('/actions', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const action = req.body.action;
    const actionId = req.body.actionId;
    
    const create = async () => {
      const definition = req.body.definition;
      const action = await actiondal.createAction(req.userId, definition, true);
      if (action && action.actionId) {
        res.status(200).send({ message: 'success', action: action });
      } else {
        // action (return value) is an error message
        res.status(200).send({ message: action ? `error: ${action}` : 'error: unknown error' });
      }
    }

    const del = async () => {
      const action = await actiondal.deleteAction(req.userId, actionId);
      res.status(200).send(
        action ? 
        { message: 'success' } :
        { message: `error: could not delete action ${actionId}` });
    }

    const edit = async () => {
      const action = await actiondal.editAction(req.userId, actionId, req.body.private);
      res.status(200).send(action ? { message: 'success', action: action } : { message: 'error' });
    }

    const fork = async () => {
      const action = await actiondal.forkAction(req.userId, actionId);
      res.status(200).send({ message: 'success', action: action });
    }

    switch (action) {
      case 'create':
        create();
        return;
      case 'delete':
        del();
        return;
      case 'edit':
        if (req.body.definition) {
          create();
        } else {
          edit();
        }
        return;
      case 'fork':
        fork();
        return;
      default:
        res.status(200).send({ message: 'Unknown action'});
        return;
    }
  });
}
