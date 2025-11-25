const router = require("express").Router();

const uapiController = require("../controllers/uapiController.js");

router.get("/airportwithcity", uapiController.getCombinedData);
router.get("/:key", uapiController.getData);

module.exports = router;
