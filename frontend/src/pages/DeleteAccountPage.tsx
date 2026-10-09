import { Link } from "react-router-dom";

import LegalPage, { LegalContact, LegalList, LegalSection } from "../components/LegalPage";

/**
 * Public, so it can be linked from app store listings. ICF FIRST is an organisation's portal, so
 * an account is cancelled rather than deleted: sign-in stops, the records stay.
 */
function DeleteAccountPage() {
  return (
    <LegalPage title="Account Deletion" updated="1 October 2026">
      <LegalSection title="Cancelling your ICF FIRST account">
        <p>
          ICF FIRST is the member portal of ICF International. When you ask for your account to be deleted, we{" "}
          <span className="font-semibold">cancel</span> it: you can no longer sign in to the ICF FIRST app or
          website. Your records are not erased, because the organisation must keep them.
        </p>
      </LegalSection>

      <LegalSection title="What happens when you cancel">
        <LegalList
          items={[
            ["Stops", "Signing in to the ICF FIRST app and website."],
            ["Kept", "Your membership record, committee history, donations and subscription records. ICF International keeps these for its organisational, financial and legal records."],
            ["Not shared", "Cancelling does not change how your information is protected. See our Privacy Policy."],
          ]}
        />
        <p>
          If you change your mind, contact your higher committee leaders or us, and we can restore your access.
          To ask for your personal data to be erased where the law allows, contact us using the details below.
        </p>
      </LegalSection>

      <LegalSection title="Cancellation by ICF">
        <p>
          ICF International may also suspend or cancel an account if its higher committees or leaders find
          that the member's activity does not follow ICF's decisions, rules or policies. The member's records
          are kept in the same way. See our{" "}
          <Link to="/termsAndConditions" className="text-blue-700 underline-offset-2 hover:underline">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="How to cancel">
        <p>
          Your account cannot be cancelled from within the app. To cancel it, contact the leaders of your higher
          committee in the ICF organisation (the committee above your unit), with your membership number. They
          will arrange the cancellation.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalContact />
      </LegalSection>
    </LegalPage>
  );
}

export default DeleteAccountPage;
