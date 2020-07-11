// snap API handlers
// 
// exports:
//   createHandlers(app): create handlers for GET and POST endpoints

const snapdal = require('./snapdal');
const requesthandler = require('../modules/requesthandler');
const { errorvalue } = require('../modules/returnvalue');

exports.createHandlers = (app) => {
  // Get gallery API endpoint
  /**
   * @swagger
   * /gallery:
   *    get:
   *      summary: Return all public snaps in this deployment
   *      description: Return all public snaps in this deployment as an array
   *      responses: 
   *        200:
   *          description: Success
   *          content: 
   *            application/json: 
   *              schema: 
   *                title: snaps
   *                type: array
   *                items: 
   *                  title: snap
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
  app.get('/gallery', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    (async () => res.status(200).send(await snapdal.getAllSnaps()))();
  });

  // Get snaps API endpoint
  app.get('/snaps', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    (async () => res.status(200).send(await snapdal.getSnaps(req.userId)))();
  });
    
  // Get snap API endpoint
  app.get('/snaps/:account/:snapName', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const account = req.params.account;
    const snapName = req.params.snapName;
    if (!account || !snapName) {
      res.status(200).send(errorvalue('account or snap name not passed in'));
    } else {
      (async () => res.status(200).send(await snapdal.getSnap(`${account}/${snapName}`)))();
    }
  });
    
  // Post snaps API endpoint
  // this will create a new snap, fork, or delete an existing snap with snapId
  app.post('/snaps', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const action = req.body.action;
    const snapId = req.body.snapId;

    switch (action) {
      case 'create':
        (async () => res.status(200).send(await snapdal.createSnap(req.userId, req.body.definition, true)))();
        return;
      case 'delete':
        (async () => res.status(200).send(await snapdal.deleteSnap(req.userId, snapId)))();
        return;
      case 'edit':
        if (req.body.definition) {
          (async () => res.status(200).send(await snapdal.createSnap(req.userId, req.body.definition, true)))();
        } else {
          (async () => res.status(200).send(await snapdal.editSnap(req.userId, snapId, req.body.private)))();
        }
        return;
      case 'fork':
        (async () => res.status(200).send(await snapdal.forkSnap(req.userId, snapId)))();
        return;
      default:
        res.status(200).send(errorvalue('Unknown action'));
        return;
    }
  });
}
