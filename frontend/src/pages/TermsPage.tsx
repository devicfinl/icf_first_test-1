import { Link } from "react-router-dom";

import LegalPage, { LegalContact, LegalList, LegalSection } from "../components/LegalPage";

function TermsPage() {
  return (
    <LegalPage title="Terms and Conditions" updated="23 September 2026">
      <LegalSection title="1. Introduction">
        <p>
          Welcome to ICF FIRST! These Terms and Conditions govern your use of the ICF FIRST member portal and
          related services provided by ICF International. By accessing or using the portal, you agree to
          comply with and be bound by these terms.
        </p>
      </LegalSection>

      <LegalSection title="2. Use of the Portal">
        <p>
          ICF FIRST is for members of ICF International. You must use the portal in compliance with all
          applicable laws and regulations.
        </p>
      </LegalSection>

      <LegalSection title="3. Your Account">
        <p>
          You sign in with your membership number and password. You are responsible for all activities that
          occur under your account, and you agree to:
        </p>
        <LegalList
          items={[
            "Keep your password private and not share your account with anyone else.",
            "Act only in a committee position you actually hold.",
            "Sign out when using a shared or public device.",
            "Tell us promptly if you believe someone else has used your account.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Intellectual Property">
        <p>
          All content, features, and functionality of the portal, including but not limited to design, text,
          graphics, and logos, are the exclusive property of ICF International.
        </p>
      </LegalSection>

      <LegalSection title="5. User Conduct">
        <p>You agree not to:</p>
        <LegalList
          items={[
            "Engage in any activity that interferes with or disrupts the portal or the servers and networks connected to it.",
            "Try to access another member's account or data, or any part of the portal you are not authorised to use.",
            "Misuse information about other members that you can see through your role.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Privacy">
        <p>
          Our{" "}
          <Link to="/privacy-policy" className="text-blue-700 underline-offset-2 hover:underline">
            Privacy Policy
          </Link>{" "}
          explains how we collect and use your personal information.
        </p>
      </LegalSection>

      <LegalSection title="7. Limitation of Liability">
        <p>
          ICF International shall not be liable for any indirect, incidental, special, or consequential
          damages resulting from the use or inability to use the portal.
        </p>
      </LegalSection>

      <LegalSection title="8. Changes to Terms">
        <p>
          We may review and update these terms at any time. Your continued use of the portal following any
          such changes will constitute your acceptance of the updated terms.
        </p>
      </LegalSection>

      <LegalSection title="9. Contact Us">
        <p>If you have any questions or concerns regarding these Terms and Conditions, please contact us at:</p>
        <LegalContact />
      </LegalSection>
    </LegalPage>
  );
}

export default TermsPage;
