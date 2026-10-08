use serde::Serialize;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;

const PAGE_SIZE: usize = 20;
const MAX_PHOTO_BYTES: usize = 2 * 1024 * 1024;
const MAX_POSTS: usize = 500;

static COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Serialize)]
pub struct FeedPost {
    pub id: String,
    pub handle: String,
    pub cut: Option<String>,
    pub caption: String,
    pub photo_url: Option<String>,
    pub created_at: u64,
}

struct Post {
    id: String,
    handle: String,
    cut: Option<String>,
    caption: String,
    photo: Option<Vec<u8>>,
    reported: bool,
    created_at: u64,
}

#[derive(Clone, Default)]
pub struct FeedStore(Arc<Mutex<Vec<Post>>>);

impl FeedStore {
    /// Anonymous, MITM-proof-ish handle: a beast + a serial number.
    fn next_handle(&self) -> String {
        const NAMES: [&str; 12] = [
            "ember-fox",
            "coal-possum",
            "smoke-owl",
            "flame-guanaco",
            "ash-puma",
            "grate-capybara",
            "leña-goat",
            "brisket-armadillo",
            "parrilla-hawk",
            "yolk-tiger",
            "bone-turkey",
            "spit-lion",
        ];
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        format!("{}-{n}", NAMES[(n as usize) % NAMES.len()])
    }

    pub async fn create(
        &self,
        cut: Option<String>,
        caption: String,
        photo: Option<Vec<u8>>,
    ) -> FeedPost {
        let photo = photo.filter(|b| !b.is_empty() && b.len() <= MAX_PHOTO_BYTES);
        let id = {
            let secs = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            format!("{secs:x}-{:x}", COUNTER.load(Ordering::Relaxed))
        };
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let handle = self.next_handle();
        let with_photo_url = photo.is_some();

        {
            let mut posts = self.0.lock().await;
            posts.push(Post {
                id: id.clone(),
                handle: handle.clone(),
                cut: cut.clone(),
                caption: caption.clone(),
                photo: photo.clone(),
                reported: false,
                created_at,
            });
            while posts.len() > MAX_POSTS {
                posts.remove(0);
            }
        }

        let photo_url = with_photo_url.then(|| format!("/api/feed/{id}/photo"));

        FeedPost {
            id,
            handle,
            cut,
            caption,
            photo_url,
            created_at,
        }
    }

    pub async fn list(&self, cursor: Option<u64>) -> (Vec<FeedPost>, Option<u64>) {
        let posts = self.0.lock().await;
        let total = posts.len();
        let skip = (cursor.unwrap_or(0) as usize).min(total);
        let remaining = total - skip;
        let take = remaining.min(PAGE_SIZE);
        let start = total - skip - take;

        let page: Vec<&Post> = posts[start..start + take].iter().rev().collect();
        let next = (remaining > take).then_some((skip + take) as u64);

        let items: Vec<FeedPost> = page
            .into_iter()
            .map(|p| FeedPost {
                id: p.id.clone(),
                handle: p.handle.clone(),
                cut: p.cut.clone(),
                caption: p.caption.clone(),
                photo_url: p
                    .photo
                    .as_ref()
                    .map(|_| format!("/api/feed/{}/photo", p.id)),
                created_at: p.created_at,
            })
            .collect();
        (items, next)
    }

    pub async fn photo(&self, id: &str) -> Option<Vec<u8>> {
        let posts = self.0.lock().await;
        posts
            .iter()
            .find(|p| p.id == id && !p.reported)
            .and_then(|p| p.photo.clone())
    }

    pub async fn report(&self, id: &str) -> bool {
        let mut posts = self.0.lock().await;
        match posts.iter_mut().find(|p| p.id == id) {
            Some(p) => {
                p.reported = true;
                true
            }
            None => false,
        }
    }
}
