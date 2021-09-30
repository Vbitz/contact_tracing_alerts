const CONTACT_TRACING_LIST = "https://www.qld.gov.au/health/conditions/health-alerts/coronavirus-covid-19/current-status/contact-tracing";
const WEBHOOK_URLS = []; // Enter your own Discord webhook URLs.
const PROP_VERSION = "v1";

function sendMessageToDiscord(message) {
  for (const discordUrl of WEBHOOK_URLS) {
    var payload = JSON.stringify({content: message});

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

  return `\`${datetext} ${timetext}\` | ${location} ${address} ${suburb} | **${advice}**`;
}

function EntryPoint() {
  const contactTracingUpdates = getCurrentContactTracingUpdates();

  const props = PropertiesService.getUserProperties();

  let discordMessage = "(Source: https://www.qld.gov.au/health/conditions/health-alerts/coronavirus-covid-19/current-status/contact-tracing)\n\n";

  const updateProps = [];

  for (const update of contactTracingUpdates) {
    const propString = JSON.stringify(update) + "_" + PROP_VERSION;

    if (props.getProperty(propString) === "true") {
      continue;
    }

    const nextLine = formatUpdate(update) + "\n";

    if ((discordMessage + nextLine).length > 2000) {
      break;
    }
    
    discordMessage += nextLine;

    updateProps.push(propString);
  }

  if (updateProps.length !== 0) {
    sendMessageToDiscord(discordMessage);
  }

  for (const str of updateProps) {
    props.setProperty(str, "true");
  }
}

function doGet() {
  EntryPoint();
  return "success";
}
