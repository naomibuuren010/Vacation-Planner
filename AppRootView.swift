import SwiftUI
import SwiftData

struct AppRootView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var countries: [Country]
    @State private var didSeed = false

    var body: some View {
        NavigationStack {
            CountriesListView()
        }
        .onAppear {
            seedIfNeeded()
        }
    }

    private func seedIfNeeded() {
        guard !didSeed, countries.isEmpty else { return }
        didSeed = true

        let thailand = Country(name: "Thailand")
        let japan = Country(name: "Japan")

        modelContext.insert(thailand)
        modelContext.insert(japan)

        let bangkok = Place(name: "Bangkok", placeType: .city, country: thailand)
        let phuket = Place(name: "Phuket", placeType: .area, country: thailand)
        let tokyo = Place(name: "Tokyo", placeType: .city, country: japan)

        modelContext.insert(bangkok)
        modelContext.insert(phuket)
        modelContext.insert(tokyo)

        // Voorbeeldpins (zodat de kaart meteen werkt).
        let grandPalace = Activity(
            place: bangkok,
            title: "Grand Palace",
            notes: "Tip: ga vroeg i.v.m. drukte.",
            url: nil,
            locationName: "Phra Borom Maha Ratchawang",
            date: nil,
            latitude: 13.7500,
            longitude: 100.4913
        )
        let riverViewHotel = Accommodation(
            place: bangkok,
            name: "River View Hotel (demo)",
            address: "Riverside Rd.",
            notes: "Voorbeeldhotel voor pins.",
            url: nil,
            date: nil,
            latitude: 13.7300,
            longitude: 100.5000
        )

        let oldTownMarket = Activity(
            place: phuket,
            title: "Old Town Market",
            notes: nil,
            url: nil,
            locationName: "Old Phuket Town",
            date: nil,
            latitude: 7.8890,
            longitude: 98.3990
        )

        let shibuyaWalk = Activity(
            place: tokyo,
            title: "Shibuya Crossing",
            notes: nil,
            url: nil,
            locationName: "Shibuya",
            date: nil,
            latitude: 35.6595,
            longitude: 139.7005
        )

        modelContext.insert(grandPalace)
        modelContext.insert(riverViewHotel)
        modelContext.insert(oldTownMarket)
        modelContext.insert(shibuyaWalk)

        try? modelContext.save()
    }
}

#if DEBUG
struct AppRootView_Previews: PreviewProvider {
    static var previews: some View {
        AppRootView()
    }
}
#endif

