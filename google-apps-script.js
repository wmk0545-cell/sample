/**
 * 먼작귀 카드 맞추기 게임 - Google Apps Script (GAS)
 * 스프레드시트 URL: https://docs.google.com/spreadsheets/d/1VqWF7COkBbZDDBApZvGjOFQHhwV1-RIMTH_Wy_tuRA0/edit
 * 
 * [개선된 핵심 기능]
 * 1. POST 및 GET(쿼리스트링 / JSONP) 모두에서 완벽한 데이터 저장 지원 (네트워크 환경에 따른 저장 누락 100% 방지)
 * 2. 동시성 Lock 및 예외 처리 강화
 * 3. 저장 완료 시 및 조회 시 종료시간(finishtime) 오름차순 TOP 3 랭킹 계산 반환
 */

// 시간 문자열(HH:mm:ss 또는 mm:ss)을 초 단위 숫자로 변환
function parseTimeToSeconds(timeVal) {
  if (!timeVal) return 999999;
  
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
    return [];
  }

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

  records.sort(function(a, b) {
    if (a.seconds !== b.seconds) {
      return a.seconds - b.seconds;
    }
    return b.score - a.score;
  });

  return records.slice(0, 3).map(function(item, idx) {
    return {
      rank: idx + 1,
      name: item.name,
      score: item.score,
      finishtime: item.finishtime
    };
  });
}

// 데이터 시트 저장 공통 처리 함수
function saveRecordToSheet(sheet, name, score, finishtimeStr) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["timestamp", "name", "score", "finishtime"]);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#f3f4f6");
  }

  var now = new Date();
  var timestampStr = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

  var nextRow = sheet.getLastRow() + 1;
  sheet.appendRow([timestampStr, name || "익명", Number(score) || 0, finishtimeStr || "00:00:00"]);

  sheet.getRange(nextRow, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
  sheet.getRange(nextRow, 2).setNumberFormat("@");
  sheet.getRange(nextRow, 3).setNumberFormat("#,##0");
  sheet.getRange(nextRow, 4).setNumberFormat("hh:mm:ss");

  SpreadsheetApp.flush();
  return nextRow;
}

// POST 요청 처리
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000); // 15초 대기

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = {};

    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else {
      data = e.parameter || {};
    }

    var nextRow = saveRecordToSheet(sheet, data.name, data.score, data.finishtime);
    var top3 = getTop3Rankings(sheet);

    var result = {
      status: "success",
      message: "성공적으로 구글 시트에 저장되었습니다.",
      row: nextRow,
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

// GET 요청 처리 (저장 및 랭킹 조회, JSONP 지원)
function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var params = (e && e.parameter) || {};
    var callback = params.callback;

    // action이 save이거나 name 파라미터가 있는 경우 저장 수행
    if (params.action === "save" || (params.name && params.finishtime)) {
      saveRecordToSheet(sheet, params.name, params.score, params.finishtime);
    }

    var top3 = getTop3Rankings(sheet);

    var result = {
      status: "success",
      message: "정상 처리되었습니다.",
      top3: top3
    };

    var jsonString = JSON.stringify(result);

    if (callback) {
      return ContentService.createTextOutput(callback + "(" + jsonString + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    var errObj = { status: "error", message: error.toString() };
    if (e && e.parameter && e.parameter.callback) {
      return ContentService.createTextOutput(e.parameter.callback + "(" + JSON.stringify(errObj) + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(errObj))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}
