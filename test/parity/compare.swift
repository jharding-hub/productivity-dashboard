// Read [[anchorMin, epochMs, jsKey], ...] on stdin; report every disagreement.
let data = FileHandle.standardInput.readDataToEndOfFile()
guard let rows = try? JSONSerialization.jsonObject(with: data) as? [[Any]] else {
    print("PARSE_FAIL"); exit(2)
}
var checked = 0, mismatches = 0
for row in rows {
    guard let anchor = row[0] as? Int,
          let ms = (row[1] as? NSNumber)?.doubleValue,
          let jsKey = row[2] as? String else { continue }
    let swiftKey = dayKey(Date(timeIntervalSince1970: ms / 1000.0), anchorMin: anchor)
    checked += 1
    if swiftKey != jsKey {
        mismatches += 1
        if mismatches <= 5 {
            print("MISMATCH anchor=\(anchor) ms=\(Int(ms)) js=\(jsKey) swift=\(swiftKey)")
        }
    }
}
print("checked=\(checked) mismatches=\(mismatches)")
exit(mismatches == 0 ? 0 : 1)
