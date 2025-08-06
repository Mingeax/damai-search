import { writeFile } from "node:fs/promises";
import { whiteKeywords, blackKeywords, city } from "./config.js";
import { judgeKeywords } from "./util.js";

// TODO: 把演出按时间排序

const baseUrl = "https://search.damai.cn/searchajax.html";

async function fetchAllPages() {
  let curPage = 1;
  const pageSize = 60;
  let hasMore = true;

  const goodPerformances = [];
  const badPerformances = [];

  const urlObj = new URL(baseUrl);
  urlObj.searchParams.set("ctl", "音乐会");
  urlObj.searchParams.set("cty", city);
  urlObj.searchParams.set("tsg", "5");
  urlObj.searchParams.set("st", "2025-08-01");
  urlObj.searchParams.set("et", "2025-08-31");

  const nameBlackKeywords = blackKeywords.name;
  const nameWhiteKeywords = whiteKeywords.name;
  const venueBlackKeywords = blackKeywords.venue;
  const venueWhiteKeywords = whiteKeywords.venue;

  while (hasMore) {
    urlObj.searchParams.set("pageSize", pageSize);
    urlObj.searchParams.set("currPage", curPage);

    console.log(`请求第${curPage}页.`);

    const res = await fetch(urlObj.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
        accept: "application/json, text/plain, */*",
        referer: "https://search.damai.cn/search.htm",
      },
    });

    const json = await res.json();
    const resultData = json.pageData.resultData;

    // 处理数据
    console.log(`第${curPage}页数据条数:`, resultData.length);

    resultData.forEach((item) => {
      const { showtime, nameNoHtml: name, venue } = item;

      let weekendFlag = false;
      let nameKeywordFlag = true;
      let venueKeywordFlag = true;

      if (showtime.includes("-")) {
        // 例: '2025.08.08-08.24'
        const [start, end] = showtime.split("-");

        const startParts = start.split(".");
        const endParts = end.split(".");

        const isEndNextYear = endParts.length === 3;

        const sYear = startParts[0];
        const sMonth = startParts[1];
        const sDate = startParts[2];

        const eYear = isEndNextYear ? endParts[0] : sYear;
        const eMonth = isEndNextYear ? 0 : endParts[0];
        const eDate = isEndNextYear ? 1 : endParts[1];

        const startDate = new Date(start);
        const endDate = new Date();

        endDate.setFullYear(eYear);

        if (eYear === sYear + 1) {
          endDate.setMonth(0);
          endDate.setDate(1);

          endDate.setDate(endDate.getDate() - 1);
        } else {
          endDate.setMonth(eMonth - 1);
          endDate.setDate(eDate);
        }

        const curDate = startDate;

        while (curDate <= endDate && curDate.getFullYear() == sYear) {
          const day = curDate.getDay();

          if (day === 0 || day === 6) {
            weekendFlag = true;
            break;
          }

          // 前进到下一个日期
          curDate.setDate(curDate.getDate() + 1);
        }
      } else {
        // 例: '2025.08.15 周五 19:30'
        const date = new Date(showtime.split(" ")[0]);

        const day = date.getDay();
        weekendFlag =
          showtime.includes("周五") ||
          showtime.includes("周六") ||
          showtime.includes("周日");
      }

      if (
        judgeKeywords(nameBlackKeywords, name) &&
        !judgeKeywords(nameWhiteKeywords, name)
      ) {
        nameKeywordFlag = false;
      }

      if (
        judgeKeywords(venueBlackKeywords, venue) &&
        !judgeKeywords(venueWhiteKeywords, venue)
      ) {
        venueKeywordFlag = false;
      }

      const recordItem = {
        id: item.id.split("_").at(-1),
        cityname: item.cityname,
        name: item.nameNoHtml,
        venue: item.venue,
        price_str: item.price_str,
        showtime,
        showstatus: item.showstatus,
      };

      if (weekendFlag && nameKeywordFlag && venueKeywordFlag) {
        goodPerformances.push(recordItem);
      } else {
        badPerformances.push(recordItem);
      }
    });

    // 判断是否还有下一页
    if (json.pageData.nextPage === curPage + 1) {
      curPage++;
      hasMore = true;
    } else hasMore = false;
  }

  await writeFile(
    "good_performances.json",
    JSON.stringify(goodPerformances, null, "\t")
  );

  await writeFile(
    "bad_performances.json",
    JSON.stringify(badPerformances, null, "\t")
  );

  console.log("请求全部完成.");
}

fetchAllPages();
