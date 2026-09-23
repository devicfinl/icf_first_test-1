import LegalPage, {
  LegalContact,
  LegalList,
  LegalSection,
  LegalSubsection,
} from "../components/LegalPage";

// Written against what the portal actually does today: sign-in by membership number, committee
// position selection, and a read-only member profile. Revisit this page when events, uploads or
// anything else that collects new data ships.
function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="23 September 2026">
      <LegalSection title="1. Introduction">
        <p>
          Welcome to ICF FIRST, the member portal developed and operated by ICF International ("we", "us",
          or "our"). We are committed to protecting your privacy and handling your personal information with
          transparency and care.
        </p>
        <p>
          This Privacy Policy explains what information we collect, how we use it, when we share it, and
          what rights you have regarding your data. By using ICF FIRST, you agree to the practices described
          in this policy.
        </p>
        <p>If you do not agree with this policy, please do not use the portal.</p>
      </LegalSection>

      <LegalSection title="2. Information We Collect">
        <LegalSubsection title="2.1 Your Membership Record">
          <p>
            ICF FIRST gives you access to the membership record ICF International already holds for you. This
            may include:
          </p>
          <LegalList
            items={[
              ["Account Information", "Your membership number, which is also your username, and your password."],
              [
                "Personal Details",
                "Full name, father's name, profile photo, date of birth, gender and marital status.",
              ],
              [
                "Contact Details",
                "Mobile number, WhatsApp number, Indian mobile number, email address and country.",
              ],
              ["Address", "Gulf address, city, house name, place, post office and district."],
              ["Background", "Profession, education, Islamic education and blood group."],
              [
                "Organisation Details",
                "Your member type, organisational unit and its hierarchy, India unit and zone, and the committee positions you hold.",
              ],
              ["Membership Status", "Whether your membership is active, verified or transferred."],
            ]}
          />
          <p>
            Your password is never stored in readable form. We keep only a secure one-way hash of it.
          </p>
        </LegalSubsection>

        <LegalSubsection title="2.2 Information Collected Automatically">
          <p>When you use ICF FIRST, we automatically collect limited technical information:</p>
          <LegalList
            items={[
              [
                "Log Data",
                "Your IP address, the time of each request, request identifiers and error logs, used to keep the service secure and working.",
              ],
              [
                "Sign-in Activity",
                "Failed sign-in attempts, used to block repeated guessing of passwords.",
              ],
              [
                "Session Data",
                "Your sign-in token and selected committee position, stored in your browser's session storage. It is removed when you sign out or close the browser tab.",
              ],
            ]}
          />
          <p>ICF FIRST does not use advertising or third-party tracking cookies.</p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection title="3. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <LegalList
          items={[
            [
              "Provide and operate the portal",
              "Authenticate you, let you choose the committee position you are acting in, and show you your membership profile.",
            ],
            [
              "Manage membership",
              "Keep ICF International's membership and committee records accurate and up to date.",
            ],
            [
              "Ensure security",
              "Detect, prevent and respond to unauthorised access, abuse and security incidents.",
            ],
            ["Improve the portal", "Diagnose technical issues and improve existing features."],
            [
              "Comply with legal obligations",
              "Respond to lawful requests from authorities and meet regulatory obligations.",
            ],
            [
              "Send important notices",
              "Tell you about changes to these policies or to your account.",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="4. How We Share Your Information">
        <p>
          We do not sell, rent, or trade your personal information to third parties. We may share your data
          in the following limited circumstances:
        </p>

        <LegalSubsection title="4.1 Within ICF International">
          <p>
            Authorised office-bearers and administrators of ICF International may see member information
            where their role requires it, for example to manage membership or committee records.
          </p>
        </LegalSubsection>

        <LegalSubsection title="4.2 Service Providers">
          <p>
            We use trusted third-party providers, such as hosting and database services, to run the portal.
            They process data only on our behalf and as we direct.
          </p>
        </LegalSubsection>

        <LegalSubsection title="4.3 Legal Requirements">
          <p>
            We may disclose your information if required to do so by law, court order, or in response to a
            valid legal process, or if we believe disclosure is necessary to protect our rights, your safety,
            or the safety of others.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection title="5. Data Retention">
        <p>
          We keep your personal information for as long as you are a member of ICF International, or as long
          as it is needed to maintain membership records. Server logs are kept only as long as needed for
          security and troubleshooting. When information is no longer needed, we delete or anonymise it,
          except where we must keep it for legal, regulatory, or legitimate organisational purposes.
        </p>
      </LegalSection>

      <LegalSection title="6. Data Security">
        <p>
          We use industry-standard technical and organisational measures to protect your personal information
          against unauthorised access, disclosure, alteration, and destruction. These include:
        </p>
        <LegalList
          items={[
            "Encrypted data transmission (HTTPS/TLS)",
            "Passwords stored only as secure one-way hashes",
            "Short-lived sign-in tokens that are revoked when you sign out or change your password",
            "Limits on repeated sign-in attempts",
            "Access controls limiting member data to authorised personnel",
          ]}
        />
        <p>
          However, no method of transmission over the internet or electronic storage is completely secure.
          While we strive to protect your data, we cannot guarantee absolute security. Please keep your
          password private and sign out when using a shared device.
        </p>
      </LegalSection>

      <LegalSection title="7. Children's Privacy">
        <p>
          ICF FIRST is intended for members of ICF International and is not directed at children under the age
          of 13 (or the applicable minimum age in your jurisdiction). If you believe we hold information about
          a child without appropriate parental consent, please contact us using the details in Section 11 and
          we will take steps to address it promptly.
        </p>
      </LegalSection>

      <LegalSection title="8. Your Rights and Choices">
        <p>Depending on your location, you may have the following rights regarding your personal data:</p>
        <LegalList
          items={[
            ["Access", "Request a copy of the personal data we hold about you."],
            ["Rectification", "Request correction of inaccurate or incomplete data."],
            ["Erasure", "Request deletion of your personal data where the law allows."],
            ["Data Portability", "Request your data in a structured, machine-readable format."],
            ["Restriction", "Request that we restrict processing of your data in certain circumstances."],
            ["Objection", "Object to the processing of your data for certain purposes."],
            ["Withdraw Consent", "Where processing is based on consent, withdraw it at any time."],
          ]}
        />
        <p>
          You can view your membership record at any time on your profile page. To exercise any of these
          rights, or to correct details in your record, please contact us using the details in Section 11. We
          will respond within 30 days of receiving your request.
        </p>
      </LegalSection>

      <LegalSection title="9. Third-Party Links and Services">
        <p>
          The portal may contain links to third-party websites or services. This Privacy Policy does not
          apply to those services. We encourage you to review the privacy policies of any third-party
          services you access through the portal.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to This Privacy Policy">
        <p>
          We may update this Privacy Policy from time to time to reflect changes in our practices, technology,
          or legal requirements. When we make material changes, we will:
        </p>
        <LegalList
          items={[
            'Update the "Last updated" date at the top of this policy.',
            "Notify you through the portal or by email where required by law.",
          ]}
        />
        <p>
          Continued use of the portal after any changes constitutes your acceptance of the updated policy. We
          encourage you to review this policy periodically.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact Us">
        <p>
          If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices,
          please contact us:
        </p>
        <LegalContact />
      </LegalSection>
    </LegalPage>
  );
}

export default PrivacyPolicyPage;
