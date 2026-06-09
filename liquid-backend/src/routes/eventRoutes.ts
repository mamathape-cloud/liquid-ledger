import express = require("express");
import eventController = require("../controllers/eventController");
import authMiddleware = require("../middleware/auth");

const router = express.Router();

function hasAnyPermission(permissions: string[]): express.RequestHandler {
  return (req, res, next): void => {
    const userPermissions = req.user?.permissions || [];

    if (!permissions.some((permission) => userPermissions.includes(permission))) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    next();
  };
}

const requireFinanceAccess = hasAnyPermission([
  "expenses.view_all",
  "expenses.disburse",
]);
const requireEventReadAccess = hasAnyPermission([
  "expenses.view_all",
  "expenses.disburse",
  "reports.view",
]);

router.use(authMiddleware.verifyToken);

router.get(
  "/assigned",
  hasAnyPermission(["expenses.view_own", "expenses.create"]),
  eventController.getAssignedEvents,
);
router.get("/employees", requireFinanceAccess, eventController.getEmployees);
router.get("/", requireEventReadAccess, eventController.getEvents);
router.post("/", requireFinanceAccess, eventController.createEvent);
router.put("/:id", requireFinanceAccess, eventController.updateEvent);
router.delete("/:id", requireFinanceAccess, eventController.deleteEvent);

export = router;
