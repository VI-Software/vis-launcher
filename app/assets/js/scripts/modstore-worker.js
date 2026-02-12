self.onmessage = function(e) {
    const { mods } = e.data
    const htmlStrings = mods.map(mod => {
        const iconUrl = mod.icon_url || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%238b5cf6%27 width=%27100%27 height=%27100%27/%3E%3Ccircle cx=%2750%27 cy=%2750%27 r=%2735%27 fill=%27none%27 stroke=%27white%27 stroke-width=%274%27/%3E%3Ctext x=%2750%27 y=%2765%27 font-size=%2748%27 font-weight=%27bold%27 fill=%27white%27 text-anchor=%27middle%27 font-family=%27sans-serif%27%3E%3F%3C/text%3E%3C/svg%3E'

        return `
            <div class="modStoreCard" title="Click to view details for ${mod.formattedTitle}" tabindex="0">
                <div class="modStoreCardHeader">
                    <img data-src="${iconUrl}" alt="${mod.formattedTitle}" class="modStoreCardIcon">
                    <div class="modStoreCardInfo">
                        <h3 class="modStoreCardTitle">${mod.formattedTitle}${mod.installedBadge}</h3>
                        <div class="modStoreCardAuthor">by ${mod.formattedAuthor}</div>
                    </div>
                </div>
                <div class="modStoreCardBody">
                    <p class="modStoreCardDescription">${mod.formattedDescription}</p>
                </div>
                <div class="modStoreCardFooter">
                    <div class="modStoreCardStats">
                        <div class="modStoreCardStat">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            ${mod.formattedDownloads}
                        </div>
                        <div class="modStoreCardStat">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            ${mod.formattedFollows}
                        </div>
                    </div>
                    <div class="modStoreCardTags">
                        <span class="modStoreCardTag">${mod.formattedCategory}</span>
                    </div>
                </div>
            </div>
        `
    })
    self.postMessage({ htmlStrings })
}