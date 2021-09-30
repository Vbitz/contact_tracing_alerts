const CONTACT_TRACING_LIST = "https://www.qld.gov.au/health/conditions/health-alerts/coronavirus-covid-19/current-status/contact-tracing";
const WEBHOOK_URLS = []; // Enter your own Discord webhook URLs.
const PROP_VERSION = "v1";

function processMessageToDiscord(urls, updates, testMode) {
  const props = PropertiesService.getUserProperties();

  const suburbs = {};

  const updateProps = [];

  for (const update of updates) {
    if (JSON.stringify(suburbs).length > 2000) {
      break;
    }

    const propString = JSON.stringify(update) + "_" + PROP_VERSION;

    if (props.getProperty(propString) === "true" && !testMode) {
      continue;
    }

    if (suburbs[update.suburb] === undefined) {
      Logger.log("Adding Suburb: %s", update.suburb)
      suburbs[update.suburb] = [];
    }

    suburbs[update.suburb].push(update);

    updateProps.push(propString);
  }

  const embeds = [];

  for (const name in suburbs) {
    let fields = [];
    for (const update of suburbs[name]) {
      fields.push(formatUpdate(update));
    }

    embeds.push({
      "title": name,
      "description": "Alerts for: **" + name + "**",
      "color": 8130835,
      "timestamp": new Date().toISOString(),
      "footer": {
        "text": "https://github.com/Vbitz/contact_tracing_alerts"
      },
      "author": {
        "name": "Queensland Health Contact Tracing (Source)",
        "url": "https://www.qld.gov.au/health/conditions/health-alerts/coronavirus-covid-19/current-status/contact-tracing"
      },
      "fields": fields
    })
  }

  if (embeds.length === 0) {
    return;
  }

  for (const discordUrl of urls) {
    var payload = JSON.stringify({
      "embeds": embeds
    });

    var params = {
      headers: {
        'Content-Type': 'application/json'
      },
      method: "POST",
      payload: payload,
      muteHttpExceptions: false
    };

    var response = UrlFetchApp.fetch(discordUrl, params);

    Logger.log(response.getContentText());
  }

  if (!testMode) {
    for (const str of updateProps) {
      props.setProperty(str, "true");
    }
  }
}

function getCurrentContactTracingUpdates() {
  const contentText = UrlFetchApp.fetch(CONTACT_TRACING_LIST).getContentText();
  const $ = Cheerio.load(contentText);

  Logger.log("Got responce");

  const mainTable = $("#qld_combined_table_202041");

  const results = [];

  const rows = mainTable.find("tr");

  rows.each(function (i) {
    const row = $(this);

    const date = unescape(row.attr("data-date"));
    
    if (date === undefined || date === "undefined") {
      return;
    }

    const advice = unescape(row.attr("data-advice"));
    const location = unescape(row.attr("data-location"));
    const address = unescape(row.attr("data-address"));
    const suburb = unescape(row.attr("data-suburb"));
    const datetext = unescape(row.attr("data-datetext"));
    const timetext = unescape(row.attr("data-timetext"));
    const added = unescape(row.attr("data-added"));

    // No more Townsville spam for Brisbane folks.
    if (suburb.indexOf("Townsville") !== -1) {
      return;
    }

    results.push({date, advice, location, address, suburb, datetext, timetext, added});
  });

  return results;
}

function formatUpdate(update) {
  const {date, advice, location, address, suburb, datetext, timetext, added} = update;

  return {name: datetext + " : " + timetext, value: `${location} ${address}\n**${advice}**`};
}

function EntryPoint() {
  const contactTracingUpdates = getCurrentContactTracingUpdates();

  processMessageToDiscord(WEBHOOK_URLS, contactTracingUpdates, false);
}

function TestFunction() {
  const contactTracingUpdates = getCurrentContactTracingUpdates();

  processMessageToDiscord([WEBHOOK_URLS[0]], contactTracingUpdates, true);
}

function doGet() {
  EntryPoint();
  return "success";
}
