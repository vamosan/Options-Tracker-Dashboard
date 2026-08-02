import { fetchSmartMoneyFlow } from './src/app/actions.ts';

const test = async () => {
    console.log("Fetching smart flow data...");
    const data = await fetchSmartMoneyFlow();
    console.log("Returned Data Length:", data.length);
    console.log(JSON.stringify(data, null, 2));
};

test();
