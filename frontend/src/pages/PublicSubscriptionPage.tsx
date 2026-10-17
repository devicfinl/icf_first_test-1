import { useParams } from "react-router-dom";

import AddSubscriberForm from "../components/pv/AddSubscriberForm";

/**
 * The public Pravasi Vayana form a leader shares (no login). The leader's place is fixed; the
 * visitor chooses the places below it. Saved as pending until a leader approves it.
 */
function PublicSubscriptionPage() {
  const { rootId } = useParams();
  const id = Number(rootId);

  return (
    <div className="min-h-screen bg-cream px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <img src="/logomain.png" alt="ICF" className="h-10 w-auto" />
        <div className="mt-6 rounded-2xl bg-white p-5 sm:p-8">
          {Number.isInteger(id) && id > 0 ? (
            <AddSubscriberForm key={id} variant="public" rootId={id} title="Pravasi Vayana Subscription" />
          ) : (
            <p className="text-center text-sm text-muted-foreground">This registration link is not valid.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PublicSubscriptionPage;
