import { parseCallListCsv } from "@/lib/campaigns/parse-csv";

const cases = [
  {
    name: "happy path",
    csv: `name,phone,reason
Alice Example,3135550101,follow up
Bob Example,2485550102,reengage`,
  },
  {
    name: "bad phones",
    csv: `name,phone,reason
Bad One,not-a-phone,follow up
Bad Two,123,reengage`,
  },
  {
    name: "duplicates",
    csv: `name,phone,reason
Alice Example,3135550101,follow up
Alice Again,(313) 555-0101,reengage`,
  },
  {
    name: "non-US numbers",
    csv: `name,phone,reason
London Contact,+442071838750,international
Detroit Contact,3135550101,local`,
  },
];

async function main() {
  for (const testCase of cases) {
    const result = await parseCallListCsv(testCase.csv);

    console.log(
      `${testCase.name}: accepted=${result.accepted_count}, rejected=${result.rejected_count}`
    );

    if (result.warnings.length > 0) {
      console.log(`  warnings=${result.warnings.join("; ")}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
