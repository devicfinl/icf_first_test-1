import { getPasswordStrength } from "../utilities/passwordStrength";

const LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"];

/**
 * Advisory only: the server's rule is a minimum of 8 characters. This nudges towards something
 * better without blocking a password the API would accept.
 */
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const score = getPasswordStrength(password);

  return (
    <div className="mb-4 -mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded ${score >= step ? "bg-green-500" : "bg-gray-200"}`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Password strength: {LABELS[Math.max(0, score - 1)]} ({score}/5)
      </p>
    </div>
  );
}

export default PasswordStrength;
