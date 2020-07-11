// activesnap API handlers
// 
// exports:
//   createHandlers(app): create handlers for GET and POST endpoints

const activesnapdal = require('./activesnapdal');
const snapengine = require('./snapengine');
const requesthandler = require('../modules/requesthandler');
const { errorvalue } = require('../modules/returnvalue');

exports.createHandlers = (app) => {
  // Get active snaps API endpoint
  /**
   * @swagger
   * /activesnaps:
   *    get:
   *      summary: Return all active snaps for this user
   *      description: Return all active snaps for this user as an array
   *      responses: 
   *        200:
   *          description: Success
   *          content: 
   *            application/json: 
   *              schema: 
   *                title: activesnaps
   *                type: array
   *                items: 
   *                  title: activesnap
   *                  type: object
   *                  properties: 
   *                    name: 
   *                      type: string
   *                    description: 
   *                      type: string
   *                    trigger: 
   *                      type: string
   *                    actions: 
   *                      type: array
   *                      items: 
   *                        type: string
   *                    parameters: 
   *                      type: array
   *                      items: 
   *                        title: parameter
   *                        type: object
   *                        properties: 
   *                          name: 
   *                            type: string
   *                          description: 
   *                            type: string
   *                    config: 
   *                      type: array
   *                      items: 
   *                        title: configentry
   *                        type: object
   *                        properties: 
   *                          name: 
   *                            type: string
   *                          provider: 
   *                            type: string
   *                    snapId: 
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
  app.get('/activesnaps', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    (async () => res.status(200).send(await activesnapdal.getActiveSnaps(req.userId)))();
  });

  // Get active snap API endpoint
  app.get('/activesnaps/:activeSnapId', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const activeSnapId = req.params.activeSnapId;
    (async () => res.status(200).send(await activesnapdal.getActiveSnap(req.userId, activeSnapId)))();
  });  
      
  // Execute active snap API endpoint
  app.post('/activesnaps/:activeSnapId', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const activeSnapId = req.params.activeSnapId;
    snapengine.executeSnap(req.userId, activeSnapId, null, null);
    res.status(200).send();
  });  
      
  // Post active snaps API endpoint
  app.post('/activesnaps', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const action = req.body.action;
    const snapId = req.body.snapId;
    
    if (!snapId) {
      res.status(200).send(errorvalue('snapId must be provided'));
      return;
    }

    switch (action) {
      case 'activate':
        (async () => res.status(200).send(await snapengine.activateSnap(req.userId, snapId, req.body.params)))();
        return;
      case 'deactivate':
        (async () => res.status(200).send(await snapengine.deactivateSnap(req.userId, snapId)))();
        return;
      case 'edit':
        (async () => res.status(200).send(await snapengine.editSnap(req.userId, snapId, req.body.params)))();
        return;
      case 'pause':
        (async () => res.status(200).send(await snapengine.pauseSnap(req.userId, snapId)))();
        return;
      case 'resume':
        (async () => res.status(200).send(await snapengine.resumeSnap(req.userId, snapId)))();
        return;
      default:
        res.status(200).send(errorvalue(`${action}: unknown action`));
        return;
    }
  });

  // Execute snap engine API endpoint
  // this endpoint is executed without a user context 
  // it is called from a provider, using a M2M token
  app.post('/executesnap/:userId/:activeSnapId', requesthandler.checkJwt, function(req, res){
    const userId = req.params.userId;
    const activeSnapId = req.params.activeSnapId;
    snapengine.executeSnap(userId, activeSnapId, req.body.event, req.body);
    res.status(200).send();
  });  
}