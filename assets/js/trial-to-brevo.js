/*
  Almuallim – send a copy of every free-trial request to Brevo.
  The existing FormSubmit email keeps working exactly as before.
  If the Brevo copy fails, nothing breaks for the visitor.
*/
(function () {
  "use strict";

  var BREVO_URL = "https://c616f6f2.sibforms.com/serve/MUIFAGnWMwsESTIcIVFRG0IG--97RqWZNoHQdmZXokujvObgC3VQ39mCftZ8mYhfuqrODAZTVRKG8A8zRyzjD84VEjAkgJGmczoKuM2LR4z2thCyd1NXOCMNytJFu4O52DDruFeFwBDXHk88WLC3TcDik0FL8kRnLva9ZJF_PWGgQR5U6lMWrE3at9x0CHQ1E0VTY5WjfX32s-dUhQ==";

  var form = document.getElementById("trialForm");
  if (!form) return; // this page has no trial form

  function val(name) {
    var f = form.elements[name];
    return f && typeof f.value === "string" ? f.value.trim() : "";
  }

  var sent = false;

  form.addEventListener("submit", function () {
    if (sent) return;

    // spam trap used by FormSubmit: if filled, it's a bot, so don't forward it
    if (val("_honey")) return;

    var email = val("email");
    if (!email) return;

    // only forward if the consent box on the form is ticked
    var consent = form.elements["consent"];
    if (consent && !consent.checked) return;

    sent = true;

    var body = new URLSearchParams();
    body.append("FIRSTNAME", val("name").slice(0, 200) || "-");
    body.append("EMAIL", email);
    body.append("CITY", val("city").slice(0, 200));
    body.append("WHATSAPP_NUMBER", val("whatsapp").slice(0, 200));
    body.append("INTERESTED_IN", val("course_interested_in").slice(0, 200));
    body.append("PACKAGE", val("preferred_package").slice(0, 200));
    body.append("NOTES", val("message").slice(0, 200) || "-"); // required by the Brevo form
    body.append("email_address_check", "");
    body.append("locale", "en");

    try {
      // sendBeacon survives the page navigating away to FormSubmit
      var ok = navigator.sendBeacon && navigator.sendBeacon(BREVO_URL, body);
      if (!ok) {
        fetch(BREVO_URL, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body
        });
      }
    } catch (err) {
      console.warn("[Trial→Brevo] copy failed:", err);
    }
  });
})();
