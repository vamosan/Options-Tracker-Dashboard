const sqlite3 = require('sqlite3').verbose(); 
const db = new sqlite3.Database('ledger.sqlite'); 
db.run(`DELETE FROM signals WHERE confidence_score < 50 OR rationale LIKE '%UNALIGNED%' OR action LIKE '%UNALIGNED%'`, (err) => { 
    if(err) console.error(err); 
    else console.log('Cleaned db'); 
    db.close(); 
});
