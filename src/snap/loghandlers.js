// log API handlers
// 
// exports:
//   createHandlers(app): create handlers for GET and POST endpoints

const logdal = require('./logdal');
const requesthandler = require('../modules/requesthandler');

exports.createHandlers = (app) => {
  // Get logs API endpoint
  /**
   * @swagger
   * /logs:
   *    get:
   *      description: return all logs for all active snaps that have been executed
   *      responses: 
   *        200:
   *          description: success
   */  
  app.get('/logs', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const returnLogs = async () => {
      const logs = await logdal.getLogs(req.userId) || {};
      res.status(200).send(logs);
    }
    returnLogs();
  });

  // Get active snap logs API endpoint
  /**
   * @swagger
   * /logs/{activeSnapId}:
   *    get:
   *      description: return all logs this active snap ID
   *      produces:
   *        - application/json
   *      parameters:
   *        - name: activeSnapId
   *          description: active snap ID
   *          in: path
   *          required: true
   *          type: string
   *      responses: 
   *        200:
   *          description: success
   */  
  app.get('/logs/:activeSnapId', requesthandler.checkJwt, requesthandler.processUser, function(req, res){
    const activeSnapId = req.params.activeSnapId;
    const returnLogs = async () => {
      const logs = await logdal.getActiveSnapLogs(req.userId, activeSnapId) || {};
      res.status(200).send(logs);
    }
    returnLogs();
  });  
}
