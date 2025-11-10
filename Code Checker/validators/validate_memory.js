window.validators.push(function validate_memory(lines, raw, issues, ctx) {
    const functions = [];
    let currentFunc = null;
    let blockStack = [];
    let pendingControl = false;
    const destructorDeletes = []; // store objects deleted in destructor
    let inDestructor = false;

    function stripLineComment(s) {
        const idx = s.indexOf('//');
        return idx >= 0 ? s.slice(0, idx) : s;
    }

    function logObjects(msg, objArray) {
        console.log(`${msg} [${objArray.join(', ')}]`);
    }

    for (let i = 0; i < lines.length; i++) {
        let rawLine = lines[i];
        let ln = stripLineComment(rawLine).trim();

        // Check for destructor start
        const destructorMatch = ln.match(/\bTranslation::~Translation\s*\(\s*\)/);
        if (destructorMatch) {
            inDestructor = true;
            blockStack = [];
            pendingControl = false;
            continue;
        }

        // Track braces for destructor
        if (inDestructor) {
            for (let pos = 0; pos < ln.length; pos++) {
                const ch = ln[pos];
                if (ch === '{') blockStack.push({ idx: i });
                else if (ch === '}') {
                    if (blockStack.length > 0) blockStack.pop();
                    if (blockStack.length === 0) inDestructor = false; // destructor ended
                }
            }

            // Detect deletes inside destructor
            const delMatch = ln.match(/\bdelete(\s*\[\])?\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/);
            if (delMatch) {
                const name = delMatch[2];
                if (!destructorDeletes.includes(name)) destructorDeletes.push(name);
                console.log(`Destructor deletes object: ${name} at line ${i + 1}`);
            }
            continue;
        }

        // --- Existing function detection ---
        const funcMatch = ln.match(/\b(?:bool|int|void|double|float|string)\s+Translation::([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
        if (funcMatch) {
            if (currentFunc) currentFunc.endLine = i;
            currentFunc = {
                name: funcMatch[1],
                startLine: i + 1,
                endLine: lines.length,
                objects: [],
                allocations: [],
                deletes: [],
                returns: []
            };
            functions.push(currentFunc);
            blockStack = [];
            pendingControl = false;
            continue;
        }

        if (!currentFunc) { pendingControl = false; continue; }

        // Track braces
        for (let pos = 0; pos < ln.length; pos++) {
            const ch = ln[pos];
            if (ch === '{') {
                const conditional = pendingControl === true;
                blockStack.push({ idx: i, conditional });
                pendingControl = false;
            } else if (ch === '}') {
                if (blockStack.length > 0) blockStack.pop();
            }
        }
        if (!ln.includes('{')) pendingControl = false;

        // --- Detect object creation ---
        let allocMatch = ln.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*new\b/);
        if (!allocMatch) {
            allocMatch = ln.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*YB_V2Util::getDBLookupSettings\s*\(/);
        }

        if (allocMatch) {
            const objName = allocMatch[1];
            currentFunc.objects.push(objName);
            currentFunc.allocations.push({ name: objName, line: i + 1 });
            console.log(`New object is created at line ${i + 1}`);
            logObjects('Current Object', currentFunc.objects);
        }

        // --- Detect deletes ---
      // --- Detect deletes ---
        const delMatch = ln.match(/\bdelete(\s*\[\])?\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/);
        if (delMatch) {
            const name = delMatch[2];
            currentFunc.deletes.push({ name, line: i + 1 });

            // Check if delete is permanent
            let permanent = true;
            for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
                const nextLine = stripLineComment(lines[j]).trim();
                if (nextLine.length === 0) continue; // skip empty lines

                // If next line is another delete, keep checking
                const nextDel = nextLine.match(/\bdelete(\s*\[\])?\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/);
                if (nextDel) continue;

                // If next line is a return, then not permanent
                const retMatch = nextLine.match(/\breturn\s+(EXIT_FAILURE|EXIT_SUCCESS|true|false)\b/);
                if (retMatch) {
                    permanent = false;
                    break;
                }

                // Any other line -> delete is permanent
                break;
            }

            if (permanent) {
                const idx = currentFunc.objects.indexOf(name);
                if (idx !== -1) currentFunc.objects.splice(idx, 1);
                console.log(`The object ${name} is permanently deleted at line ${i + 1}`);
                logObjects('Current Object', currentFunc.objects);
            } else {
                console.log(`The object ${name} is deleted but not permanent at line ${i + 1}`);
                logObjects('Current Object', currentFunc.objects);
            }
        }


        // --- Detect returns ---
        const retMatch = ln.match(/\breturn\s+(EXIT_SUCCESS|EXIT_FAILURE|true|false)\s*;/);
        if (retMatch) {
            const retType = retMatch[1];

            // Find objects deleted in previous 5 lines
            const deletedObjects = [];
            for (let k = Math.max(0, i - 5); k < i; k++) {
                const dMatch = lines[k].match(/\bdelete(\s*\[\])?\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/);
                if (dMatch) deletedObjects.push(dMatch[2]);
            }

            const ignoredObjects = [];
            for (let obj of currentFunc.objects) {
                // skip if deleted in destructor
                if (destructorDeletes.includes(obj)) continue;

                for (let lookBack = Math.max(0, i - 5); lookBack <= i; lookBack++) {
                    const errorCheck = lines[lookBack].match(new RegExp(obj + "->isError\\s*\\(\\)"));
                    if (errorCheck) ignoredObjects.push(obj);
                }
            }

            currentFunc.objects.forEach(objName => {
                if (!deletedObjects.includes(objName) && !ignoredObjects.includes(objName) && !destructorDeletes.includes(objName)) {
                    console.warn(`Object ${objName} allocated before line ${i + 1} is not deleted before return ${retType}`);
                    issues.push({
                        type: "Missing delete before return",
                        line: i + 1,
                        snippet: ln,
                        detail: `Object "${objName}" allocated in function "${currentFunc.name}" is not deleted before return '${retType}', nor in destructor.`
                    });
                }
            });
        }

        // catch(...) considered EXIT_FAILURE
        if (/^\s*catch\s*\(/.test(ln)) {
            const deletedObjects = [];
            for (let k = Math.max(0, i - 5); k < i; k++) {
                const dMatch = lines[k].match(/\bdelete(\s*\[\])?\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/);
                if (dMatch) deletedObjects.push(dMatch[2]);
            }

            const ignoredObjects = [];
            for (let obj of currentFunc.objects) {
                if (destructorDeletes.includes(obj)) continue;

                for (let lookBack = Math.max(0, i - 5); lookBack <= i; lookBack++) {
                    const errorCheck = lines[lookBack].match(new RegExp(obj + "->isError\\s*\\(\\)"));
                    if (errorCheck) ignoredObjects.push(obj);
                }
            }

            currentFunc.objects.forEach(objName => {
                if (!deletedObjects.includes(objName) && !ignoredObjects.includes(objName) && !destructorDeletes.includes(objName)) {
                    console.warn(`Object ${objName} allocated before line ${i + 1} is not deleted before catch`);
                    issues.push({
                        type: "Missing delete before catch",
                        line: i + 1,
                        snippet: ln,
                        detail: `Object "${objName}" allocated in function "${currentFunc.name}" is not deleted before catch, nor in destructor.`
                    });
                }
            });
        }
    }

    console.log('Objects deleted in destructor:', destructorDeletes);
});
