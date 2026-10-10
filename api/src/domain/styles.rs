use serde::Serialize;

#[derive(Serialize)]
pub struct Marker {
    pub id: &'static str,
    pub col: u32,
    pub row: u32,
    pub color: &'static str,
}

#[derive(Serialize)]
pub struct Style {
    pub id: &'static str,
    pub region: &'static str,
    pub style: &'static str,
    pub fuel: &'static str,
    pub span: &'static str,
    pub blurb: &'static str,
}

/// Regional grill styles — mirrors `app/src/screens/Landing.tsx`.
pub static STYLES: &[Style] = &[
    Style {
        id: "cordoba",
        region: "Sierras de Córdoba",
        style: "Quebracho country",
        fuel: "leña",
        span: "slow start, long finish",
        blurb: "The heartland. Thick quebracho splits burn down to a bed that feeds the rack all afternoon.",
    },
    Style {
        id: "buenosaires",
        region: "Buenos Aires",
        style: "Parrilla porteña",
        fuel: "carbón",
        span: "every weekend",
        blurb: "The classic: tira and achuras over a tight charcoal bed, beers in, feuds out.",
    },
    Style {
        id: "uruguay",
        region: "Uruguay",
        style: "Parrilla a la leña",
        fuel: "leña + carbón",
        span: "all year",
        blurb: "The stove-and-coal hybrid, open all winter. Chivito fills the weekdays.",
    },
    Style {
        id: "patagonia",
        region: "Patagonia",
        style: "Cordero al asador",
        fuel: "fire pit",
        span: "half a day",
        blurb: "Whole lamb on a cross, facing the wind, one rotation rule: patient.",
    },
    Style {
        id: "norte",
        region: "The North",
        style: "Asado del monte",
        fuel: "rama seca",
        span: "quick and wild",
        blurb: "Dry scrub-wood fires, fast and loud. The embers are hot, the meat moves.",
    },
];

pub static MARKERS: &[Marker] = &[
    Marker {
        id: "norte",
        col: 10,
        row: 6,
        color: "#E8483B",
    },
    Marker {
        id: "cordoba",
        col: 11,
        row: 8,
        color: "#FF6B1A",
    },
    Marker {
        id: "buenosaires",
        col: 14,
        row: 12,
        color: "#C1463F",
    },
    Marker {
        id: "uruguay",
        col: 21,
        row: 9,
        color: "#FFC93C",
    },
    Marker {
        id: "patagonia",
        col: 14,
        row: 18,
        color: "#7A2E12",
    },
];
