const fs = require('fs');
const cheerio = require('cheerio');
const mongoose = require('mongoose');

function main() {


    mongoose.connect('mongodb://localhost:27017/sysi', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    const Event = mongoose.model('Event', new mongoose.Schema({
        title: String,
        start: String,
        url: String,
        location: String,
        description: String,
    }));

    const parseDate = (text) => {
        if (!text) return null;

        const clean = text.replace(/[–—]/g, '-');
        const match = clean.match(/([A-Za-z]+ \d{1,2}, \d{4})/);

        if (!match) return null;

        const parts = new Date(match[1]);

        // Extract YYYY-MM-DD manually using local time
        const yyyy = parts.getFullYear();
        const mm = String(parts.getMonth() + 1).padStart(2, '0');
        const dd = String(parts.getDate()).padStart(2, '0');

        return `${yyyy}-${mm}-${dd}`; // ✅ No timezone shift
    };



    function runSync() {
        const html = fs.readFileSync('community-events.html', 'utf8');
        const $ = cheerio.load(html);
        const events = [];

        $('.swiper-slide.card-link').each((_, el) => {
            const $el = $(el);
            const url = $el.attr('href') || '';
            const title = $el.find('h3').text().trim();
            const dateText = $el.find('p').first().text();
            const locationText = $el.find('p').eq(1).text();
            const description = $el.find('p').eq(2).text().trim();
            const start = parseDate(dateText);
            const location = locationText.replace(/^📍\s*/, '');

            if (title && start) {
                events.push({ title, start, url, location, description });
            }
        });

        // Write shared-events.js
        const jsContent = `// shared-events.js\nwindow.sharedEvents = ${JSON.stringify(events, null, 2)};\n`;
        fs.writeFileSync('shared-events.js', jsContent);

        // Sync MongoDB
        Event.deleteMany({})
            .then(() => Event.insertMany(events))
            .then(() => console.log(`✅ Synced ${events.length} events to MongoDB & shared-events.js`))
            .catch(err => console.error('❌ Sync error:', err));
    }

    runSync(); // initial run

    // Watch the HTML file for changes
    fs.watchFile('community-events.html', { interval: 1000 }, (curr, prev) => {
        console.log('🔄 Detected change in community-events.html');
        runSync();
    });
}
module.exports = main;