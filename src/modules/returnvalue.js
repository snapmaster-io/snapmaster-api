// universal return value constructor for SnapMaster API
// 
// exports:
//   successvalue(data): return a success code and the associated data
//   errorvalue(message, data): return an error code with optional data

/**
 * Construct a return value object with a status and optional message and data.
 * 
 * @param {Object} data The data field 
 * @returns {Object} The return value object
 */
exports.successvalue = (data) => createReturnValue('success', null, data);

/**
 * Construct a return value object with a status and optional message and data.
 * 
 * @param {string} message An optional error message
 * @param {Object} data An optional data field
 * @returns {Object} The return value object
 */
exports.errorvalue = (message, data) => createReturnValue('error', message, data);

/**
 * Construct a return value object with a status and optional message and data.
 * 
 * @param {string} status The status {'success', 'error'}
 * @param {string} message An optional error message
 * @param {Object} data An optional data field
 * @returns {Object} The return value object
 */
const createReturnValue = (status, message, data) => {
  const returnval = { status };

  if (status === 'success') {
    returnval.ok = true;
  }

  if (status === 'error') {
    returnval.error = true;
  }

  if (message) {
    returnval.message = message;
  }

  if (data) {
    returnval.data = data;
  }

  // print full error object including stack trace to the console if it's provided
  if (status === 'error' && data) {
    console.error(data);
  }

  return returnval;
}