// Adapted from: https://blog.jeremylikness.com/blog/implement-progressive-web-app-hugo/
class Pwa {
  constructor(self) {
    this.scope = self;
    const Version = new URL(location).searchParams.get("version");
    this.CACHE_VERSION = Version;
    this.BASE_CACHE_FILES = [
      "/",
      "/lib/img/profile_picture.jpg",
      "/offline/",
      "/profile/",
      "/publications/",
      "/affiliations/",
      "/404.html",
      "/site.webmanifest",
    ];
    this.OFFLINE_PAGE = "/offline/";
    this.NOT_FOUND_PAGE = "/404.html";
    this.CACHE_NAME = `data-v.${this.CACHE_VERSION}`;
  }

  async deleteOldCaches() {
    try {
      let keys = await caches.keys();
      keys
        .filter((key) => key != this.CACHE_NAME)
        .map((key) => caches.delete(key));
    } catch (err) {
      console.error(err);
    }
  }

  async installServiceWorker() {
    try {
      await caches.open(this.CACHE_NAME).then(
        (cache) => {
          return cache.addAll(this.BASE_CACHE_FILES);
        },
        (err) => console.error(`Error with ${this.CACHE_NAME}`, err)
      );
      return this.scope.skipWaiting();
    } catch (err) {
      return console.error("Error with installation: ", err);
    }
  }

  register() {
    this.scope.addEventListener("install", (event) => {
      event.waitUntil(
        Promise.all([this.installServiceWorker(), this.scope.skipWaiting()])
      );
    });

    this.scope.addEventListener("activate", (event) => {
      event.waitUntil(
        Promise.all([
          this.deleteOldCaches(),
          this.scope.clients.claim(),
          this.scope.skipWaiting(),
        ]).catch((err) => {
          console.error("Activation error: ", err);
          event.skipWaiting();
        })
      );
    });

    this.scope.addEventListener("fetch", (event) => {
      event.respondWith(
        // Cache then network strategy
        caches.open(this.CACHE_NAME).then(async (cache) => {
          return fetch(event.request)
            .then(async (response) => {
              await cache.put(event.request, response.clone());
              return response;
            })
            .catch(async () => {
              const response = await cache.match(event.request);
              if (response) {
                return response;
              }
              return await cache.match(this.OFFLINE_PAGE);
            });
        })
      );
    });
  }
}

const pwa = new Pwa(self);
pwa.register();
