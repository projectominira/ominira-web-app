/** The monthly report's Typst layout. Figures arrive preformatted as JSON in
 * `sys.inputs.data` (see reportPdf); summary and updates are Typst markup. */
// A plain template string: Bun's String.raw escapes non-ASCII (· → \u00B7). No backslashes or ${ inside.
export const TEMPLATE = `
#let d = json(bytes(sys.inputs.data))
#let brand = rgb("#be400d")
#let ink = rgb("#1c1917")
#let muted = rgb("#78716c")
#let rule = rgb("#e7e5e4")

#set document(title: "Project Ominira — " + d.label)
#set page(paper: "a4", margin: (x: 2.2cm, top: 2cm, bottom: 2.2cm),
  footer: context text(8pt, fill: muted)[Project Ominira · #d.label #h(1fr) #counter(page).display()])
#set text(font: "Libertinus Serif", size: 11pt, fill: ink)
#set par(leading: 0.7em, spacing: 1.1em)
#show heading.where(level: 2): it => block(above: 1.6em, below: 0.8em)[
  #text(9pt, weight: "bold", fill: brand, tracking: 0.08em, upper(it.body))
  #v(-0.5em) #line(length: 100%, stroke: 0.5pt + rule)
]

#let nice(v) = {
  if v <= 0 { return 1 }
  let p = calc.pow(10, calc.floor(calc.log(v)))
  for f in (1, 2, 2.5, 5, 10) { if f * p >= v { return f * p } }
}

// A line chart: series of (values, color, dash); none values are skipped.
#let chart(title, labels, series, height: 3.6cm, zero: true) = block(breakable: false, width: 100%)[
  #text(9pt, weight: "bold")[#title]
  #v(0.2em)
  #layout(size => {
    let w = size.width - 24pt
    let n = labels.len()
    let vals = series.map(s => s.values.filter(v => v != none)).flatten()
    let top = nice(calc.max(1, ..vals))
    // Lines needn't start at 0: from the step below the lowest value, so growth shows.
    let step = top / 4
    let bottom = if zero { 0 } else { calc.floor(calc.min(..vals) / step) * step }
    let x(i) = 24pt + if n > 1 { w * i / (n - 1) } else { 0pt }
    let y(v) = height * (1 - (v - bottom) / (top - bottom))
    let every = calc.max(1, calc.ceil(n / 6))
    box(width: size.width, height: height + 14pt, {
      for v in (bottom, (bottom + top) / 2, top) {
        place(dx: 24pt, dy: y(v), line(length: w, stroke: 0.4pt + rule))
        place(dx: 0pt, dy: y(v) - 4pt, text(7pt, fill: muted, str(calc.round(v))))
      }
      for s in series {
        let pts = s.values.enumerate().filter(p => p.at(1) != none).map(p => (x(p.at(0)), y(p.at(1))))
        if pts.len() > 1 {
          place(curve(stroke: (paint: s.color, thickness: 1.5pt, dash: s.at("dash", default: none), join: "round"),
            curve.move(pts.first()), ..pts.slice(1).map(p => curve.line(p))))
        }
      }
      for (i, l) in labels.enumerate() {
        if calc.rem(n - 1 - i, every) == 0 {
          place(dx: x(i) - 15pt, dy: height + 4pt, box(width: 30pt, align(center, text(7pt, fill: muted, l))))
        }
      }
    })
  })
]
#let key(color, label, dash: none) = box[#box(baseline: -0.25em, line(length: 12pt, stroke: (paint: color, thickness: 1.5pt, dash: dash))) #h(3pt) #text(8pt, fill: muted, label)]

#let figures(rows) = table(
  columns: (1fr, auto, auto, auto),
  align: (left, right, right, right),
  stroke: (x, y) => if y == 0 { (bottom: 0.6pt + ink) } else { (bottom: 0.4pt + rule) },
  inset: (x: 6pt, y: 5pt),
  table.header(..([Figure], d.label, d.previous, [Change]).map(c => text(8.5pt, weight: "bold", c))),
  ..rows.map(r => (r.label, text(weight: "bold", r.now), text(fill: muted, r.before), text(fill: muted, r.change))).flatten(),
)

#text(8.5pt, weight: "bold", fill: brand, tracking: 0.08em)[PROJECT OMINIRA · MONTHLY REPORT]
#v(-0.4em)
#text(22pt)[#d.label]

Hello comrades. Ahead of our meeting, here is the update on Ominira for #d.label.

== Summary
#eval(d.summary, mode: "markup")

== Membership
#figures(d.membership)
#v(0.4em)
#text(9.5pt, fill: muted)[#d.target]
#v(0.6em)
#chart("Members since launch", d.weeks, ((values: d.members, color: brand), (values: d.targets, color: muted, dash: "dashed")), zero: false)
#key(brand, "Members") #h(10pt) #key(muted, "Target: 10% a week", dash: "dashed")

== Readership
#figures(d.readership)
#v(0.4em)
#text(9.5pt, fill: muted)[An active reader is a member who read or listened that day, week or month. Weekly figures are averages over the month's 7-day stretches. #d.caveats.join(" ")]
#v(0.6em)
#grid(columns: (1fr, 1fr), gutter: 16pt,
  chart("Weekly active readers", d.weeks, ((values: d.readers, color: brand),)),
  chart("Reading hours per week", d.weeks, ((values: d.hours, color: ink),)),
)

== Library
#figures(d.library)

== Updates
Here is what we shipped in #d.label:
#v(0.6em)
#for u in d.updates [- #eval(u, mode: "markup")]
`;
