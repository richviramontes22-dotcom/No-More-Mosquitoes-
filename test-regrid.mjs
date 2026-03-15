const REGRID_API_KEY = process.env.REGRID_API_KEY;
const REGRID_API_BASE = "https://api.regrid.com/api/v2";

async function testRegrid() {
  if (!REGRID_API_KEY) {
    console.log("REGRID_API_KEY is not set");
    return;
  }

  const address = "1600 Pennsylvania Ave NW";
  const zip = "20500";
  const searchQuery = encodeURIComponent(`${address}, ${zip}`);

  const endpoints = [
    `${REGRID_API_BASE}/parcels/search?q=${searchQuery}&limit=1`,
    `${REGRID_API_BASE}/parcels?q=${searchQuery}&limit=1`,
    `${REGRID_API_BASE}/parcels/typeahead?query=${searchQuery}&limit=1`,
    `${REGRID_API_BASE}/parcels?query=${searchQuery}&limit=1`,
  ];

  for (const url of endpoints) {
    console.log(`Testing: ${url}`);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${REGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
      });
      console.log(`Status: ${response.status}`);
      const data = await response.json();
      console.log(`Data: ${JSON.stringify(data).substring(0, 100)}...`);
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
    console.log("---");
  }
}

testRegrid();
