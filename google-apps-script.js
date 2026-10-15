/**
 * 먼작귀 카드 맞추기 게임 - Google Apps Script (GAS)
 * 스프레드시트 URL: https://docs.google.com/spreadsheets/d/1VqWF7COkBbZDDBApZvGjOFQHhwV1-RIMTH_Wy_tuRA0/edit
 * 
 * [기능]
 * 1. doPost: 게임 성공 시 [timestamp, name, score, finishtime] 저장 후, 상위 3명 랭킹 데이터 반환
 * 2. doGet: 현재 구글 시트에 저장된 종료시간 기준 상위 3명 랭킹 반환 (또는 JSONP 지원)
 */

// 시간 문자열(HH:mm:ss 또는 mm:ss 등)을 초 단위 숫자로 변환하는 헬퍼 함수
function parseTimeToSeconds(timeVal) {
  if (!timeVal) return 999999;
  
  // Date 객체로 넘어온 경우
  if (timeVal instanceof Date) {
    return timeVal.getHours() * 3600 + timeVal.getMinutes() * 60 + timeVal.getSeconds();
  }

  var str = String(timeVal).trim();
  var parts = str.split(":").map(function(item) {
    return parseInt(item, 10) || 0;
  });

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 999999;
}

// 종료시간 오름차순(가장 빠른 순) 상위 3명 가져오기
function getTop3Rankings(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return []; // 헤더만 있거나 데이터가 없음
  }

  // 2행부터 데이터 읽기 (A: timestamp, B: name, C: score, D: finishtime)
  var range = sheet.getRange(2, 1, lastRow - 1, 4);
  var values = range.getValues();

  var records = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var timestamp = row[0];
    var name = String(row[1] || "").trim();
    var score = Number(row[2]) || 0;
    var finishtime = row[3];

    if (!name) continue;

    var seconds = parseTimeToSeconds(finishtime);

    // 날짜/시간 포맷 정돈
    var finishtimeStr = "";
    if (finishtime instanceof Date) {
      finishtimeStr = Utilities.formatDate(finishtime, "Asia/Seoul", "HH:mm:ss");
    } else {
      finishtimeStr = String(finishtime);
    }

    records.push({
      name: name,
      score: score,
      finishtime: finishtimeStr,
      seconds: seconds,
      timestamp: timestamp instanceof Date ? Utilities.formatDate(timestamp, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss") : String(timestamp)
    });
  }

  // 종료시간(seconds) 기준 오름차순 정렬 (빠른 순), 동일 시간일 경우 점수 높은 순 / 먼저 달성한 순
  records.sort(function(a, b) {
    if (a.seconds !== b.seconds) {
      return a.seconds - b.seconds;
    }
    return b.score - a.score;
  });

  // 상위 3명 추출 및 순위(rank) 부여
  var top3 = records.slice(0, 3).map(function(item, idx) {
    return {
      rank: idx + 1,
      name: item.name,
      score: item.score,
      finishtime: item.finishtime
    };
  });

  return top3;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // 동시성 제어 10초 락

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 첫 행 헤더가 없는 경우 자동 생성
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["timestamp", "name", "score", "finishtime"]);
      sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#f3f4f6");
    }

    var data = {};
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter;
      }
    } else {
      data = e.parameter;
    }

    var name = data.name || "익명";
    var score = Number(data.score) || 0;
    var finishtimeStr = data.finishtime || "00:00:00";

    var now = new Date();
    var timestampStr = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

    // 새 행 추가
    var nextRow = sheet.getLastRow() + 1;
    sheet.appendRow([timestampStr, name, score, finishtimeStr]);

    // 서식 적용
    sheet.getRange(nextRow, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
    sheet.getRange(nextRow, 2).setNumberFormat("@");
    sheet.getRange(nextRow, 3).setNumberFormat("#,##0");
    sheet.getRange(nextRow, 4).setNumberFormat("hh:mm:ss");

    SpreadsheetApp.flush(); // 즉시 반영

    // 저장 후 최신 TOP 3 랭킹 계산
    var top3 = getTop3Rankings(sheet);

    var result = {
      status: "success",
      message: "성공적으로 구글 시트에 저장되었습니다.",
      top3: top3
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var top3 = getTop3Rankings(sheet);

    var callback = e.parameter && e.parameter.callback;
    var jsonString = JSON.stringify({
      status: "success",
      top3: top3
    });

    if (callback) {
      // JSONP 요청 지원
      return ContentService.createTextOutput(callback + "(" + jsonString + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
