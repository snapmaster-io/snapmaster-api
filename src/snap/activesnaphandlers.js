// activesnap API handlers
// 
// exports:
//   createHandlers(app): create handlers for GET and POST endpoints

const activesnapdal = require('./activesnapdal');
const snapengine = require('./snapengine');
const requesthandler = require('../modules/requesthandler');

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
    const returnActiveSnaps = async () => {
      const activesnaps = await activesnapdal.getActiveSnaps(req.userId) || {};
      res.status(200).send(activesnaps);
    }
    returnActiveSnaps();
  });

  // Get active snap API endpoint
  app.get('/activesnaps/:activeSnapId', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const activeSnapId = req.params.activeSnapId;
    const returnActiveSnap = async () => {
      const activeSnap = await activesnapdal.getActiveSnap(req.userId, activeSnapId) || {};
      res.status(200).send(activeSnap);
    }
    returnActiveSnap();
  });  
      
  // Execute active snap API endpoint
  app.post('/activesnaps/:activeSnapId', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const activeSnapId = req.params.activeSnapId;
    const executeSnap = async () => {
      snapengine.executeSnap(req.userId, activeSnapId, null, null);
      res.status(200).send();
    }
    executeSnap();
  });  
      
  // Post active snaps API endpoint
  app.post('/activesnaps', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const action = req.body.action;
    const snapId = req.body.snapId;
    
    const activateSnap = async () => {
      const status = await snapengine.activateSnap(req.userId, snapId, req.body.params);
      res.status(200).send(status);
    }

    const deactivateSnap = async () => {
      const status = await snapengine.deactivateSnap(req.userId, snapId);
      res.status(200).send(status);
    }

    const editSnap = async () => {
      const status = await snapengine.editSnap(req.userId, snapId, req.body.params);
      res.status(200).send(status);
    }
    
    const pauseSnap = async () => {
      const status = await snapengine.pauseSnap(req.userId, snapId);
      res.status(200).send(status);
    }

    const resumeSnap = async () => {
      const status = await snapengine.resumeSnap(req.userId, snapId);
      res.status(200).send(status);
    }

    if (!snapId) {
      res.status(200).send({ message: 'Unknown snapId'});  
      return;
    }

    switch (action) {
      case 'activate':
        activateSnap();
        return;
      case 'deactivate':
        deactivateSnap();
        return;
      case 'edit':
        editSnap();
        return;
      case 'pause':
        pauseSnap();
        return;
      case 'resume':
        resumeSnap();
        return;
      default:
        res.status(200).send({ message: 'Unknown action'});
        return;
    }
  });

  // Execute snap engine API endpoint
  // this endpoint is executed without a user context 
  // it is called from a provider, using a M2M token
  app.post('/executesnap/:userId/:activeSnapId', requesthandler.checkJwt, function(req, res){
    const userId = req.params.userId;
    const activeSnapId = req.params.activeSnapId;
    const executeSnap = async () => {
      snapengine.executeSnap(userId, activeSnapId, req.body.event, req.body);
      res.status(200).send();
    }
    executeSnap();
  });  
}