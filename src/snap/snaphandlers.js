// snap API handlers
// 
// exports:
//   createHandlers(app): create handlers for GET and POST endpoints

const snapdal = require('./snapdal');
const requesthandler = require('../modules/requesthandler');

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
    const returnGallery = async () => {
      const gallery = await snapdal.getAllSnaps() || {};
      res.status(200).send(gallery);
    }
    returnGallery();
  });

  // Get snaps API endpoint
  app.get('/snaps', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const returnSnaps = async () => {
      const snaps = await snapdal.getSnaps(req.userId) || {};
      res.status(200).send(snaps);
    }
    returnSnaps();
  });
    
  // Get snap API endpoint
  app.get('/snaps/:account/:snapName', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const account = req.params.account;
    const snapName = req.params.snapName;
    if (!account || !snapName) {
      res.status(200).send({ message: 'error'});
      return;
    }

    const returnSnap = async () => {
      const snap = await snapdal.getSnap(`${account}/${snapName}`);
      res.status(200).send(snap);
    }
    returnSnap();
  });
    
  // Post snaps API endpoint
  // this will create a new snap, fork, or delete an existing snap with snapId
  app.post('/snaps', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const action = req.body.action;
    const snapId = req.body.snapId;
    
    const create = async () => {
      const definition = req.body.definition;
      const snap = await snapdal.createSnap(req.userId, definition, true);
      if (snap && snap.snapId) {
        res.status(200).send({ message: 'success', snap: snap });
      } else {
        // snap (return value) is an error message
        res.status(200).send({ message: snap ? `error: ${snap}` : 'error: unknown error' });
      }
    }

    const del = async () => {
      const snap = await snapdal.deleteSnap(req.userId, snapId);
      res.status(200).send(
        snap ? 
        { message: 'success' } :
        { message: `error: could not delete snap ${snapId}` });
    }

    const edit = async () => {
      const snap = await snapdal.editSnap(req.userId, snapId, req.body.private);
      res.status(200).send(snap ? { message: 'success', snap: snap } : { message: 'error' });
    }

    const fork = async () => {
      const snap = await snapdal.forkSnap(req.userId, snapId);
      res.status(200).send({ message: 'success', snap: snap });
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
