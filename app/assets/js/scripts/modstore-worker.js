self.onmessage = function(e) {
    const { mods } = e.data
    const htmlStrings = mods.map(mod => {
        const iconUrl = mod.icon_url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%238b5cf6" width="100" height="100"/></svg>'

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