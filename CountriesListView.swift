import SwiftUI
import SwiftData

struct CountriesListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Country.name) private var countries: [Country]

    var body: some View {
        Group {
            if countries.isEmpty {
                ContentUnavailableView(
                    "Nog geen landen",
                    systemImage: "globe"
                )
            } else {
                List(countries) { country in
                    NavigationLink {
                        CountryDetailView(country: country)
                    } label: {
                        Text(country.name)
                    }
                }
            }
        }
        .navigationTitle("Landen")
    }
}

