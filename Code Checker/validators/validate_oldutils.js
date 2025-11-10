// validators/validate_oldutils.js
window.validators.push(function validate_oldutils(lines, raw, issues) {
    const utilsMap = [
        { old: /YB_V2Util::takeField/, new: "String::TakeField" },
        { old: /YB_V2TransUtil::isBeginWith/, new: "String::IsBeginWith" },
        { old: /YB_V2TransUtil::fixField(?=_Old)?/, new: "String::FixField" },
        { old: /YB_V2TransUtil::trimString/, new: "String::Trim" },
        { old: /YB_V2TransUtil::replaceChar/, new: "String::ReplaceChar" },
        { old: /YB_V2Util::removeChar/, new: "String::RemoveChar" },
        { old: /YB_V2TransUtil::toString/, new: "String::ToString" },
        { old: /YB_V2TransUtil::countField/, new: "String::CountField" },
        { old: /YB_V2TransUtil::formatFloatNumber/, new: "Number::FormatDouble" },
        { old: /YB_V2TransUtil::strpad/, new: "String::PadString" },
        { old: /stricmp/, new: 'strcmp(String::ToUpper(a), String::ToUpper(b))' },
        { old: /YB_V2TransUtil::htmlEncode/, new: "String::BasicXmlEncode" },
        { old: /YB_V2TransUtil::strlen/, new: "length()" },
        { old: /YB_V2Util::dateTime/, new: "DateTimeB->ToString" },
        { old: /YB_V2TransUtil::isNumeric/, new: "String::IsNumeric" },
        { old: /YB_V2Util::getHostname/, new: "YB_V2Util::getEnvironmentName" },
        { old: /YB_V2TransUtil::toLower/, new: "String::ToLower" },
        { old: /YB_V2TransUtil::toUpper/, new: "String::ToUpper" },
    ];

    const specialCases = [
        {
            name: "fixField_Old",
            regex: /YB_V2TransUtil::fixField_Old\(([^,]+),\s*(\d+),\s*(\d+)\)/,
            handler: (str, start, len) => {
                const newStart = parseInt(start, 10) - 1;
                return `String::FixField(${str}, ${newStart}, ${len})`;
            },
            detail: "Second parameter must be minus 1 for new FixField"
        },
        {
            name: "countField",
            regex: /YB_V2TransUtil::countField\(([^,]+),\s*([^\)]+)\)/,
            handler: (str, delimiter) => `String::CountField(${str}, ${delimiter})`,
            detail: "Check special case: if storeNum == 1 instead of 0"
        },
        {
            name: "formatFloatNumber",
            regex: /YB_V2TransUtil::formatFloatNumber\(([^,]+),\s*([0-9]+)\)/,
            handler: (varName, precision) => {
                if (precision !== "0") {
                    return `Number::FormatDouble(${varName}, ${precision})`;
                } else {
                    return null; // keep as-is
                }
            },
            detail: "Only convert to Number::FormatDouble if precision != 0"
        },
        {
            name: "strpad",
            regex: /YB_V2TransUtil::strpad\(([^,]+),\s*([0-9]+)\)/,
            handler: (str, len) => `String::PadString(${str}, ' ', ${len}, String::PADRIGHT)`,
            detail: "Convert strpad to PadString (default PADRIGHT)"
        },
    ];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Check special cases first
        specialCases.forEach(sc => {
            const m = line.match(sc.regex);
            if (m) {
                const suggestion = sc.handler(...m.slice(1));
                issues.push({
                    type: `old utility - ${sc.name}`,
                    line: i + 1,
                    snippet: line.trim(),
                    detail: suggestion ? `${sc.detail}. Suggestion: ${suggestion}` : sc.detail
                });
            }
        });

        // Then general mappings
        utilsMap.forEach(util => {
            if (util.old.test(line)) {
                issues.push({
                    type: "old utility",
                    line: i + 1,
                    snippet: line.trim(),
                    detail: `Replace ${line.match(util.old)[0]} with ${util.new}`
                });
            }
        });
    }
});
