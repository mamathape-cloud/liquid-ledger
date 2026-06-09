import express = require("express");
import expenseController = require("../controllers/expenseController");
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

router.use(authMiddleware.verifyToken);

router.post("/", authMiddleware.hasPermission("expenses.create"), expenseController.createExpense);
router.get(
  "/",
  hasAnyPermission(["expenses.view_own", "expenses.view_all"]),
  expenseController.getExpenses,
);
router.get(
  "/:id",
  hasAnyPermission(["expenses.view_own", "expenses.view_all"]),
  expenseController.getExpenseById,
);
router.put(
  "/:id",
  hasAnyPermission(["expenses.view_own", "expenses.view_all"]),
  expenseController.updateExpense,
);
router.patch(
  "/:id/submit",
  authMiddleware.hasPermission("expenses.create"),
  expenseController.submitExpense,
);
router.post(
  "/:id/submit",
  authMiddleware.hasPermission("expenses.create"),
  expenseController.submitExpense,
);
router.patch(
  "/:id/status",
  hasAnyPermission([
    "expenses.view_own",
    "expenses.create",
    "expenses.approve",
    "expenses.disburse",
    "expenses.upload_proof",
    "expenses.audit",
  ]),
  expenseController.updateExpenseStatus,
);
router.patch(
  "/:id/approve",
  authMiddleware.hasPermission("expenses.approve"),
  expenseController.approveExpense,
);
router.patch(
  "/:id/reject",
  authMiddleware.hasPermission("expenses.approve"),
  expenseController.rejectExpense,
);
router.patch(
  "/:id/disburse",
  authMiddleware.hasPermission("expenses.disburse"),
  expenseController.disburseExpense,
);
router.patch(
  "/:id/proof",
  hasAnyPermission(["expenses.view_own", "expenses.upload_proof"]),
  expenseController.uploadProof,
);
router.patch(
  "/:id/audit",
  authMiddleware.hasPermission("expenses.audit"),
  expenseController.auditExpense,
);
router.delete(
  "/:id",
  hasAnyPermission(["expenses.view_own", "expenses.view_all"]),
  expenseController.deleteExpense,
);

export = router;
