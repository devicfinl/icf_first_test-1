import { Link } from "react-router-dom";

import LegalPage, { LegalList, LegalSection, SUPPORT_EMAIL } from "../components/LegalPage";
import ChildSafetyReportForm from "../components/ChildSafetyReportForm";

/**
 * Public child safety standards, linked from the Google Play and App Store listings, so keep the
 * path stable. Wording must match what the portal actually does: it has no public sign-up, no
 * messaging and no user uploads.
 */

// App and developer names must match the store listing exactly. Change UPDATED whenever the wording changes.
const APP_NAME = "ICF FIRST";
const DEVELOPER_NAME = "ICF International";
const EFFECTIVE_DATE = "23 October 2026";
const UPDATED = "23 October 2026";

const linkClass = "text-blue-700 underline-offset-2 hover:underline";

function ChildSafetyPage() {
  return (
    <LegalPage title={`Child Safety Standards – ${APP_NAME}`} updated={UPDATED}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">App</dt>
        <dd className="font-medium text-foreground">{APP_NAME}</dd>
        <dt className="text-muted-foreground">Developer</dt>
        <dd className="font-medium text-foreground">{DEVELOPER_NAME}</dd>
        <dt className="text-muted-foreground">Effective date</dt>
        <dd className="font-medium text-foreground">{EFFECTIVE_DATE}</dd>
      </dl>

      <LegalSection id="commitment" title="1. Our commitment">
        <p>
          {APP_NAME} by {DEVELOPER_NAME} has zero tolerance for child sexual abuse and exploitation (CSAE). These
          standards apply to every account and to all content in {APP_NAME}.
        </p>
      </LegalSection>

      <LegalSection id="age" title={`2. Who can use ${APP_NAME}`}>
        <p>
          {APP_NAME} is the member portal of {DEVELOPER_NAME}. There is no public sign-up: accounts are created
          by {DEVELOPER_NAME} for its members only, and a member signs in with their membership number.
        </p>
        <p>
          The portal is not directed at children. If you believe an account is being used by or for a child,
          report it using the form below or contact us, and we will review it promptly.
        </p>
      </LegalSection>

      <LegalSection id="prohibited" title="3. Prohibited content and conduct">
        <p>The following are strictly prohibited:</p>
        <LegalList
          items={[
            "Child sexual abuse material (CSAM) of any kind, including drawn, computer-generated or AI-generated material.",
            "Grooming, or any attempt to contact a child for sexual purposes.",
            "Sextortion, and trafficking of children.",
            "Sharing, requesting or linking to CSAM.",
            "Sexualising minors in any way, including as fiction or role-play.",
            "Creating or using an account for a child.",
          ]}
        />
        <p className="font-medium text-foreground">Any violation leads to permanent cancellation of the account.</p>
      </LegalSection>

      <LegalSection id="prevention" title="4. How we prevent abuse">
        <LegalList
          items={[
            ["Closed membership", `Only ${DEVELOPER_NAME} can create accounts, so strangers cannot sign up.`],
            ["No private messaging or uploads", `${APP_NAME} has no chat between users, and users cannot post photos, videos or other media.`],
            ["Limited visibility", "Members see other members' details only where their committee role requires it."],
            ["Account controls", `${DEVELOPER_NAME} can suspend or cancel any account immediately.`],
          ]}
        />
      </LegalSection>

      <LegalSection id="reporting" title="5. How to report">
        <p>
          Anyone can report a child safety concern with the form below, without signing in. You can also email
          us at <span className="select-text font-medium text-foreground">{SUPPORT_EMAIL}</span>. Child safety reports are handled before any other request and are kept confidential.
        </p>
        <ChildSafetyReportForm />
      </LegalSection>

      <LegalSection id="csam" title="6. How we handle CSAM">
        <p>When we find or are told about child sexual abuse material or exploitation, we:</p>
        <LegalList
          items={[
            "Remove the content immediately.",
            "Permanently cancel the accounts involved.",
            "Preserve the records required by law.",
            "Report confirmed CSAM to the Indian authorities through cybercrime.gov.in or the police, and to NCMEC or the local authorities in other countries.",
            "Cooperate fully with law enforcement.",
          ]}
        />
      </LegalSection>

      <LegalSection id="review" title="7. Review and updates">
        <p>
          We review these standards at least once a year, and whenever the law or app store policies change. See
          also our{" "}
          <Link to="/termsAndConditions" className={linkClass}>
            Terms &amp; Conditions
          </Link>{" "}
          and{" "}
          <Link to="/privacyPolicy" className={linkClass}>
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}

export default ChildSafetyPage;
