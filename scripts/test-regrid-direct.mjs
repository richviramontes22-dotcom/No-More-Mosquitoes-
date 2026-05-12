const REGRID_API_KEY = process.env.REGRID_API_KEY?.trim();

async function test(query) {
  const url = `https://app.regrid.com/api/v2/parcels/query?q=${encodeURIComponent(query)}&limit=1&token=${REGRID_API_KEY}`;
  console.log(`Testing: ${query}`);
  try {
    const response = await fetch(url);
    console.log(`Status: ${response.status}`);
    const data = await response.json();
    console.log(`Features: ${data.features?.length || 0}`);
  } catch (err) {
    console.error(err);
  }
}

async function run() {
  await test("22216 Caminito Escobedo, 92653");
}

run();
