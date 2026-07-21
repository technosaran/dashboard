export function getFriendlyErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("duplicate key value") || msg.includes("unique constraint")) {
      return "This record already exists. Please check for duplicates.";
    }
    if (msg.includes("foreign key constraint") || msg.includes("violates foreign key constraint")) {
      return "This record is linked to other items and cannot be modified or deleted directly.";
    }
    if (msg.includes("not null constraint")) {
      return "A required field is missing.";
    }
    if (msg.includes("check constraint")) {
      return "Provided data is invalid according to database rules.";
    }
    if (msg.includes("timeout")) {
      return "The request timed out. Please try again.";
    }
    if (msg.includes("unauthorized") || msg.includes("not authenticated")) {
      return "You must be logged in to perform this action.";
    }
    return err.message; // fallback
  }
  
  if (typeof err === "string") {
    return err;
  }
  
  return "An unexpected error occurred.";
}
