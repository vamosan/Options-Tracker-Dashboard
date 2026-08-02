const { XMLParser } = require('fast-xml-parser');

async function test() {
    const q1 = encodeURIComponent('Stock Market Finance Options when:1d');
    const u1 = `https://news.google.com/rss/search?q=${q1}&ceid=US:en&hl=en-US&gl=US`;

    // Also try the when:1h logic from Breaking news
    const q2 = encodeURIComponent('Breaking Stock Market Finance News when:1h');
    const u2 = `https://news.google.com/rss/search?q=${q2}&ceid=US:en&hl=en-US&gl=US`;

    // Also try a normal query without when:1d to see if that works better
    const q3 = encodeURIComponent('Stock Market Finance');
    const u3 = `https://news.google.com/rss/search?q=${q3}&ceid=US:en&hl=en-US&gl=US`;

    let p = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

    console.log('--- Testing Current Market News Query (' + u1 + ') ---');
    try {
        const r1 = await fetch(u1);
        const x1 = await r1.text();
        let parsed1 = p.parse(x1);
        let items1 = parsed1.rss?.channel?.item;
        let a1 = Array.isArray(items1) ? items1 : (items1 ? [items1] : []);
        console.log('Total items fetched:', a1.length);
        if (a1.length > 0) {
            console.log('Unsorted first 3:');
            a1.slice(0, 3).forEach(i => console.log(i.title, '|', i.pubDate));
            console.log('\nSorted newest first:');
            a1.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
            a1.slice(0, 3).forEach(i => console.log(i.title, '|', i.pubDate, '| Parsed:', new Date(i.pubDate).toLocaleString()));
        }
    } catch (e) { console.error(e) }

    console.log('\n--- Testing Current Breaking News Query (' + u2 + ') ---');
    try {
        const r2 = await fetch(u2);
        const x2 = await r2.text();
        let parsed2 = p.parse(x2);
        let items2 = parsed2.rss?.channel?.item;
        let a2 = Array.isArray(items2) ? items2 : (items2 ? [items2] : []);
        console.log('Total items fetched:', a2.length);
        if (a2.length > 0) {
            a2.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
            a2.slice(0, 3).forEach(i => console.log(i.title, '|', i.pubDate, '| Parsed:', new Date(i.pubDate).toLocaleString()));
        }
    } catch (e) { console.error(e) }

    console.log('\n--- Testing Fallback Query without when (' + u3 + ') ---');
    try {
        const r3 = await fetch(u3);
        const x3 = await r3.text();
        let parsed3 = p.parse(x3);
        let items3 = parsed3.rss?.channel?.item;
        let a3 = Array.isArray(items3) ? items3 : (items3 ? [items3] : []);
        console.log('Total items fetched:', a3.length);
        if (a3.length > 0) {
            a3.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
            a3.slice(0, 3).forEach(i => console.log(i.title, '|', i.pubDate, '| Parsed:', new Date(i.pubDate).toLocaleString()));
        }
    } catch (e) { console.error(e) }
}
test();
