const puppeteer = require('puppeteer');

const username = process.env.USERNAME;
const password = process.env.PASSWORD;

(async () => {
    console.log('> launch chrome...')
    const browser = await puppeteer.launch({
        args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-first-run',
            '--no-sandbox',
            '--no-zygote',
            '--single-process'
        ]
    });
    //const browser = await puppeteer.launch({ headless: false }); // default is true
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', interceptedRequest => {
        if (
            interceptedRequest.resourceType() == "stylesheet"
            || interceptedRequest.resourceType() == "image"
            || interceptedRequest.resourceType() == "media"
            || interceptedRequest.resourceType() == "font"
         )
            interceptedRequest.abort();
        else
            interceptedRequest.continue();
    });
    await page.goto('https://manaba.tsukuba.ac.jp/ct/home__all?chglistformat=list', {
        waitUntil: "domcontentloaded",
    });
    console.log("> load SSO page...")
    await page.waitForSelector('input[name="j_username"]');
    await page.type('input[name="j_username"]', username);
    await page.type('input[name="j_password"]', password);
    await page.click('button[type="submit"]');
    console.log("> login...")
    await page.waitForSelector('table.courselist > tbody');
    await page.waitForNetworkIdle();
    //await page.select('div.showmore > select:nth-child(1)','all')

    console.log('> get courses...')
    const courses = await page.$$eval('table.courselist > tbody > tr:not(.title)', (trs) => {
        var courses = [];
        for(var tr of trs){
            const status = [];
            tr.querySelectorAll('td:nth-child(1) div.course-card-status > img').forEach( (img) => {
                status.push(img.title)
            })
            courses.push({
                title: tr.querySelector('td:nth-child(1) > span.courselist-title > a').innerHTML,
                link: tr.querySelector('td:nth-child(1) > span.courselist-title > a').href,
                status: status,
                year: tr.querySelector('td:nth-child(2)').innerHTML,
                schedule: tr.querySelector('td:nth-child(3) > span').title,
                teacher: tr.querySelector('td:nth-child(4)').innerHTML,
            })
        }
        return courses;
    })
    console.log(courses)
    await page.screenshot({
        path: 'example.png',
        fullPage: true,
    });

    for (var course of courses) {
        const page2 = await browser.newPage();
        await page2.setRequestInterception(true);
        page2.on('request', interceptedRequest => {
            if (interceptedRequest.resourceType() == "document")
                interceptedRequest.continue();
            else
                interceptedRequest.abort();
        });
        await page2.goto(course.link + '_news', {
            waitUntil: "domcontentloaded",
        });
        await page2.waitForSelector('div.contentbody-s');
        console.log('> get news of ' + course.link)
        existNews = await page2.$('table.stdlist');
        if (existNews == null) continue;
        const news = await page2.$$eval('table.stdlist > tbody > tr:not(.title)', (trs) => {
            var news = [];
            for (var tr of trs) {
                news.push({
                    title: tr.querySelector('td:nth-child(1) > a').innerHTML,
                    link: tr.querySelector('td:nth-child(1) > a').href,
                    time: tr.querySelector('td:nth-child(3)').textContent,
                })
            }
            return news;
        })
        console.log(news);
        for (var content of news) {
            const page3 = await browser.newPage();
            await page3.setRequestInterception(true);
            page3.on('request', interceptedRequest => {
                if (interceptedRequest.resourceType() == "document")
                    interceptedRequest.continue();
                else
                    interceptedRequest.abort();
            });
            await page3.goto(content.link, {
                waitUntil: "domcontentloaded",
            });
            console.log('> get body of ' + content.link)
            await page3.waitForSelector('div.msg-body');
            const body = await page3.$eval('div.msg-body', (body) => {
                    return {
                        subject: body.querySelector('h2.msg-subject').textContent,
                        text: body.querySelector('div.msg-text').textContent,
                    }
            })
            console.log(body);
            await page3.close()
        }
        await page2.close()
    }

    await browser.close();
})();