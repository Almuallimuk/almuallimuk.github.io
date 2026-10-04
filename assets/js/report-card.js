/*
  Almuallim – Free Level Check: PDF report card
  ---------------------------------------------
  Needs (load BEFORE this file):
    <link href="https://fonts.googleapis.com/css2?family=Amiri&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>

  Usage (call when the user clicks "Download report card"):
    downloadReportCard({
      course: "quran",                  // "quran" or "islam"
      name: "Ahmed",                    // optional, "" is fine
      level: "Level 1 – Beginner",
      score: 6, total: 10,
      recommendedLesson: "Q-05 Madd",
      weakAreas: ["Q-05 Madd", "Q-09 Ghunnah"]   // strings, 0-3 items
    });
*/
(function () {
  var AYAT = {
    quran: {
      ar: "وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا",
      en: "…and recite the Qur'an slowly and distinctly, giving each letter its due.",
      ref: "Surah Al-Muzzammil 73:4",
    },
    islam: {
      ar: "وَقُل رَّبِّ زِدْنِي عِلْمًا",
      en: "And say: My Lord, increase me in knowledge.",
      ref: "Surah Ta-Ha 20:114",
    },
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function ctaText(weak) {
    var focus = weak && weak.length
      ? "Based on your result, your key areas to strengthen are <strong>" +
        weak.map(esc).join("</strong> and <strong>") + "</strong>."
      : "Based on your result, you are doing well — keep revising regularly.";
    return (
      focus +
      " Learning these is important for every Muslim. You can learn them from any trusted " +
      "Islamic scholar or institution. If you would like to learn with us, claim your " +
      "<strong>free trial class</strong> at <strong>almuallim.uk</strong>."
    );
  }

  function buildHtml(r) {
    var ayah = AYAT[r.course] || AYAT.quran;
    var title = r.course === "islam" ? "Islam: Foundations &amp; Practice" : "Qur'an Reading &amp; Tajweed";
    var date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    var pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
    var weakList = (r.weakAreas || []).length
      ? "<ul>" + r.weakAreas.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul>"
      : "<p>No weak areas found. MashaAllah!</p>";

    return (
      '<div style="width:794px;min-height:1050px;box-sizing:border-box;padding:48px;background:#fff;' +
      'font-family:Inter,Arial,sans-serif;color:#1b2a24;">' +
        '<div style="border-bottom:3px solid #C7A15C;padding-bottom:14px;margin-bottom:24px;">' +
          '<div style="font-size:26px;font-weight:700;color:#0A2A1F;">Almuallim</div>' +
          '<div style="font-size:13px;color:#6b7a73;">Online Quran Academy UK · Free Level Check Report</div>' +
        "</div>" +

        '<div style="text-align:center;background:#0A2A1F;color:#fff;border-radius:12px;padding:22px 18px;margin-bottom:24px;">' +
          '<div dir="rtl" lang="ar" style="font-family:Amiri,serif;font-size:34px;line-height:1.8;color:#E4C98A;">' + ayah.ar + "</div>" +
          '<div style="font-size:14px;margin-top:6px;">&ldquo;' + esc(ayah.en) + "&rdquo;</div>" +
          '<div style="font-size:12px;color:#E4C98A;margin-top:4px;">' + esc(ayah.ref) + "</div>" +
        "</div>" +

        '<div style="font-size:13px;color:#6b7a73;margin-bottom:4px;">' + (r.name ? "Prepared for <strong>" + esc(r.name) + "</strong> · " : "") + date + "</div>" +
        '<h2 style="margin:0 0 16px;font-size:22px;color:#0A2A1F;">' + title + "</h2>" +

        '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">' +
          row("Score", esc(r.score) + " / " + esc(r.total) + " (" + pct + "%)") +
          row("Your level", esc(r.level)) +
          row("Recommended starting lesson", esc(r.recommendedLesson)) +
        "</table>" +

        '<h3 style="font-size:16px;margin:0 0 6px;color:#0A2A1F;">Areas to revise</h3>' +
        '<div style="font-size:14px;margin-bottom:24px;">' + weakList + "</div>" +

        '<div style="background:#FBF6E9;border-left:4px solid #C7A15C;border-radius:8px;padding:16px 18px;font-size:14px;line-height:1.6;">' +
          ctaText(r.weakAreas) +
        "</div>" +

        '<div style="margin-top:28px;font-size:11px;color:#8a978f;text-align:center;">almuallim.uk · info@almuallim.uk</div>' +
      "</div>"
    );
  }

  function row(label, value) {
    return (
      '<tr><td style="padding:10px 12px;border:1px solid #e6dfcc;background:#faf7ef;width:38%;font-weight:600;">' +
      label + '</td><td style="padding:10px 12px;border:1px solid #e6dfcc;">' + value + "</td></tr>"
    );
  }

  window.downloadReportCard = async function (result) {
    if (typeof html2pdf === "undefined") {
      alert("PDF tool did not load. Please refresh and try again.");
      return;
    }
    // make sure Arabic font is ready before drawing, otherwise letters fall back to a plain font
    try { await document.fonts.load('34px "Amiri"', "وَ"); await document.fonts.ready; } catch (e) {}

    var host = document.createElement("div");
    host.style.cssText = "position:fixed;top:0;left:0;z-index:-1;background:#fff;";
    host.innerHTML = buildHtml(result);
    document.body.appendChild(host);

    try {
      await html2pdf()
        .set({
          margin: 0,
          filename: "Almuallim-Report-Card.pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "px", format: [794, 1123], orientation: "portrait", hotfixes: ["px_scaling"] },
        })
        .from(host.firstChild)
        .save();
    } finally {
      document.body.removeChild(host);
    }
  };
})();
