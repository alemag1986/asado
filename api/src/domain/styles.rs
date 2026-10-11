use serde::Serialize;

#[derive(Serialize)]
pub struct Marker {
    pub id: &'static str,
    pub lat: f64,
    pub lon: f64,
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

/// Regional grill styles — mirrors `app/src/lib/region.ts`.
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
        lat: -24.782,
        lon: -65.423,
        color: "#E8483B",
    },
    Marker {
        id: "cordoba",
        lat: -31.42,
        lon: -64.188,
        color: "#FF6B1A",
    },
    Marker {
        id: "buenosaires",
        lat: -34.603,
        lon: -58.382,
        color: "#C1463F",
    },
    Marker {
        id: "uruguay",
        lat: -34.905,
        lon: -56.191,
        color: "#FFC93C",
    },
    Marker {
        id: "patagonia",
        lat: -42.771,
        lon: -65.036,
        color: "#7A2E12",
    },
];
