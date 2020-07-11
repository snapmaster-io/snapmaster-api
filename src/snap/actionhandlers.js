// action API handlers
// 
// exports:
//   createHandlers(app): create handlers for GET and POST endpoints

const requesthandler = require('../modules/requesthandler');
const actiondal = require('./actiondal');
const snapengine = require('./snapengine');

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
    (async () => res.status(200).send(await actiondal.getActions(req.userId)))();
  });
    
  // Get action API endpoint
  app.get('/actions/:account/:actionName', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const account = req.params.account;
    const actionName = req.params.actionName;
    if (!account || !actionName) {
      res.status(200).send(errorvalue('account or action name not passed in'));
    } else {
      (async () => res.status(200).send(await actiondal.getAction(`${account}/${actionName}`)))();
    }
  });
    
  // Post actions API endpoint
  // this will create a new action, fork, or delete an existing action with actionId
  app.post('/actions', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const action = req.body.action;
    const actionId = req.body.actionId;

    switch (action) {
      case 'create':
        (async () => res.status(200).send(await actiondal.createAction(req.userId, req.body.url, req.body.definition)))();
        return;
      case 'delete':
        (async () => res.status(200).send(await actiondal.deleteAction(req.userId, actionId)))();
        return;
      case 'execute':
        (async () => res.status(200).send(await snapengine.executeAction(req.userId, actionId, req.body.operation, req.body.params)))();
        return;
      default:
        res.status(200).send(errorvalue('Unknown action'));
        return;
    }
  });
}
