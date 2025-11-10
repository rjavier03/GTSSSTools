// validators/validate_oldutils.js
window.validators.push(function validate_oldutils(lines, raw, issues) {
    const utilsMap = [
        { old: /YB_V2Util::takeField/, new: "String::TakeField" },
        { old: /YB_V2TransUtil::isBeginWith/, new: "String::IsBeginWith" },
        { old: /YB_V2TransUtil::fixField(?=_Old)?/, new: "String::FixField" }, // includes fixField_Old now
        { old: /YB_V2TransUtil::trimString/, new: "String::Trim" },
        { old: /YB_V2TransUtil::replaceChar/, new: "String::ReplaceChar" },
        { old: /YB_V2Util::removeChar/, new: "String::RemoveChar" },
        { old: /YB_V2TransUtil::toString/, new: "String::ToString" },
        { old: /YB_V2TransUtil::countField/, new: "String::CountField" }, // now normal rule
        { old: /YB_V2TransUtil::formatFloatNumber/, new: "Number::FormatDouble" }, // special skip logic below
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

    // ✅ Only formatFloatNumber keeps special condition
    const specialCases = [
        {
            name: "formatFloatNumber",
            regex: /YB_V2TransUtil::formatFloatNumber\((.+?),\s*([0-9]+)\)/,
            handler: (param1, precision) => {
                if (precision.trim() === "0") {
                    return null; // skip if precision = 0
                }
                return `Number::FormatDouble(${param1.trim()}, ${precision.trim()})`;
            },
            detail: "Only convert to Number::FormatDouble if precision != 0"
        },
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1️⃣ Handle special case (formatFloatNumber only)
        specialCases.forEach(sc => {
            const m = line.match(sc.regex);
            if (m) {
                const suggestion = sc.handler(...m.slice(1));
                if (suggestion) {
                    issues.push({
                        type: `old utility - ${sc.name}`,
                        line: i + 1,
                        snippet: line.trim(),
                        detail: `${sc.detail}. Suggestion: ${suggestion}`
                    });
                }
            }
        });

        // 2️⃣ Handle general mappings (skip formatFloatNumber because it's already processed)
        utilsMap.forEach(util => {
            if (util.old.source.includes("formatFloatNumber")) return;

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
