import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import ArrivalDatePicker from "../components/ArrivalDatePicker";
import Loading from "./Loading";
import { generateCountryTrip, getCountryInfo, getQuizResponse } from "../services/api";
import { clearPlanningSession, countryPlanningUrl, itineraryUrl, paths, withPlanningReturn } from "../services/navigation";
import "./country-planning.css";

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function CountryPlanning({ countryCode }) {
  const [country, setCountry] = useState(null);
  const [countryError, setCountryError] = useState("");
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [nights, setNights] = useState(6);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);
  const signedIn = Boolean(localStorage.getItem("token"));
  const today = localToday();
  const returnTo = countryCode ? countryPlanningUrl(countryCode) : paths.globe;
  const assessmentLink = withPlanningReturn(paths.assessment, returnTo);
  const loginLink = withPlanningReturn(paths.login, returnTo);

  useEffect(() => {
    if (!countryCode) return;
    const controller = new AbortController();
    getCountryInfo(countryCode, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setCountry(data); })
      .catch(requestError => {
        if (!controller.signal.aborted) setCountryError(requestError.response?.status === 404
          ? "This country could not be found." : "Couldn't load country details. Please try again.");
      });
    if (signedIn) getQuizResponse({ signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        const quiz = data.quizResponse;
        const hasAssessment = quiz && typeof quiz === "object" && Object.keys(quiz).length > 0;
        setProfile({ hasAssessment, signedIn: true });
        if (hasAssessment) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(quiz.startDate || "") && quiz.startDate >= localToday()) setStartDate(quiz.startDate);
          if (Number.isInteger(quiz.minNights) && quiz.minNights >= 0 && quiz.minNights <= 20) setNights(quiz.minNights);
        }
      })
      .catch(requestError => {
        if (controller.signal.aborted) return;
        if ([401, 403].includes(requestError.response?.status)) setProfile({ signedIn: false });
        else setProfileError("Couldn't load your travel preferences. Please try again.");
      });
    return () => controller.abort();
  }, [countryCode, signedIn, attempt]);

  function retrySetup() {
    setCountryError(""); setProfileError(""); setCountry(null); setProfile(null);
    setAttempt(value => value + 1);
  }

  async function generate(event) {
    event.preventDefault();
    if (inFlight.current || country?.planningAvailable !== true || !profile?.hasAssessment) return;
    inFlight.current = true;
    setError(""); setGenerating(true);
    try {
      const { data } = await generateCountryTrip(countryCode, { startDate, numberOfNights: Number(nights) });
      if (!data.trip?.tripId || !data.itinerary?.days?.length) throw new Error("The server did not return a complete itinerary. Please try again.");
      clearPlanningSession(sessionStorage);
      sessionStorage.setItem("voyager_trip", JSON.stringify(data.trip));
      sessionStorage.setItem("voyager_itinerary", JSON.stringify(data.itinerary));
      sessionStorage.setItem("currentTripId", data.trip.tripId);
      window.location.assign(itineraryUrl(data.trip.tripId));
    } catch (requestError) {
      const code = requestError.response?.data?.code;
      if ([401, 403].includes(requestError.response?.status)) setProfile({ signedIn: false });
      else if (code === "ASSESSMENT_REQUIRED" || code === "INVALID_ASSESSMENT") setProfile({ signedIn: true, hasAssessment: false });
      else if (code === "COUNTRY_NOT_READY") setCountry(previous => ({ ...previous, planningAvailable: false }));
      setError(requestError.response?.data?.message || requestError.message || "Couldn't create your itinerary. Please try again.");
      setGenerating(false);
    } finally { inFlight.current = false; }
  }

  if (generating) return <Loading backLink={returnTo} backText="Back to trip setup" />;

  const supported = country?.planningAvailable === true;
  const needsLogin = !signedIn || profile?.signedIn === false;
  const loading = countryCode && !countryError && !profileError && (!country || (supported && !needsLogin && !profile));

  return <div className="country-planning">
    <Navbar />
    <main className="country-planning__main">
      <section className="country-planning__card" aria-busy={Boolean(loading)}>
        <a className="country-planning__back" href={paths.globe}>← Back to your globe</a>
        <h1>{country ? <><span aria-hidden="true">{country.flag} </span>Plan your trip to {country.name}</> : "Plan your trip"}</h1>
        {!countryCode && <p role="alert">Select a country from your globe to start planning.</p>}
        {loading && <p role="status">Loading your trip setup…</p>}
        {(countryError || profileError) && <div role="alert">
          <p>{countryError || profileError}</p>
          <button className="country-planning__secondary" type="button" onClick={retrySetup}>Try again</button>
        </div>}
        {country && !supported && <p>Trip planning isn't available for {country.name} yet. You can still explore its information on the globe.</p>}
        {country && supported && needsLogin && <>
          <p>Sign in to plan this trip using your travel preferences.</p>
          <a className="primary-button" href={loginLink}>Sign in to plan your trip</a>
        </>}
        {supported && !needsLogin && profile && !profile.hasAssessment && <>
          <p>Complete your travel assessment first. We'll bring you back to {country.name} afterward.</p>
          <a className="primary-button" href={assessmentLink}>Complete your assessment</a>
        </>}
        {supported && profile?.hasAssessment && !needsLogin && !profileError && <form onSubmit={generate}>
          <p>We'll use your saved travel preferences to create your itinerary in {country.name}.</p>
          <div className="country-planning__fields">
            <ArrivalDatePicker id="country-trip-arrival" min={today} value={startDate} onChange={setStartDate} />
            <label htmlFor="country-trip-nights">Number of nights
              <input id="country-trip-nights" name="numberOfNights" type="number" min="0" max="20" step="1" required value={nights} onChange={event => setNights(event.target.value)} />
            </label>
          </div>
          <p className="country-planning__hint">{Number(nights) + 1} days · {nights} nights. We'll choose a route that fits your pace and trip length.</p>
          <div className="country-planning__actions">
            <button className="primary-button" type="submit">Create my itinerary</button>
            <a className="country-planning__back" href={assessmentLink}>Update travel preferences</a>
          </div>
        </form>}
        {error && <p className="country-planning__error" role="alert">{error}</p>}
      </section>
    </main>
  </div>;
}
