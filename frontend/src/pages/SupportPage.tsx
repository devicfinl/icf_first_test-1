import { Link } from "react-router-dom";

import LegalPage, { LegalContact, LegalList, LegalSection, SUPPORT_EMAIL } from "../components/LegalPage";

function SupportPage() {
  return (
    <LegalPage title="Support" updated="1 October 2026">
      <LegalSection title="Need help?">
        <p>
          If you have a problem with ICF FIRST or a question about your membership, you can get help in two
          ways:
        </p>
        <LegalList
          items={[
            [
              "Contact your higher committee leaders",
              "The leaders of the committee above your unit in the ICF organisation know your membership and can often help straight away, or pass your request on.",
            ],
            ["Email us", SUPPORT_EMAIL],
          ]}
        />
        <p>Whichever you choose, please include:</p>
        <LegalList
          items={[
            "Your membership number (never your password).",
            "What you were trying to do, and what happened instead.",
            "The device and app or browser you were using.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Common questions">
        <LegalList
          items={[
            ["I can't sign in", "Check your membership number (2 letters followed by 7 digits) and password. After too many wrong attempts, sign-in is paused for a few minutes."],
            ["I want to change my password", "Sign in, then open Change password from your dashboard or profile."],
            ["My details are wrong", "Contact us with the correct details and we will update your membership record."],
            ["\"Your login is disabled\"", "Your account has been cancelled, or suspended by ICF. Contact your higher committee leaders or email us to ask for it to be restored."],
          ]}
        />
        <p>
          To stop using ICF FIRST, see{" "}
          <Link to="/deleteAccount" className="text-blue-700 underline-offset-2 hover:underline">
            Account Deletion
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalContact />
      </LegalSection>
    </LegalPage>
  );
}

export default SupportPage;
