// define some constants - system info "userId", snapmaster userId, and invoke info "document name"
exports.systemInfo = '__system_info';
exports.invokeInfo = '__invoke_info';
exports.snapMasterUserId = 'snapmaster';

// define signups "userId" and emails "collection"
exports.signups = '__signups';
exports.emailsCollection = 'emails';

// define snaps collection
exports.snapsCollection = 'snaps';
exports.activeSnapsCollection = 'active';

// snap field names
exports.snapPrivateField = 'private';

// name of history "collection" and metadata "collection"
exports.history = '__history';

// metadata field names which get spliced in with data
exports.metadataIdField = '__id';
exports.metadataEntityField = '__entity';
exports.metadataUserIdField = '__userId';
exports.metadataProviderField = '__provider';
exports.metadataSentimentField = '__sentiment';
exports.metadataSentimentScoreField = '__sentimentScore';
exports.metadataTextField = '__text';
exports.metadataNewFlag = '__new';

// various section names for __system_info and profile
exports.dataPipelineSection = 'dataPipeline';
exports.loadSection = 'load';
exports.snapshotSection = 'snapshot';
exports.lastUpdatedTimestamp = 'lastUpdatedTimestamp';
exports.inProgress = 'inProgress';
exports.refreshHistory = 'refreshHistory';
exports.profile = 'profile';
