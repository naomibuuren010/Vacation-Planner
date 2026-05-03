import SwiftUI
import SwiftData
import CoreLocation

struct AddEditActivityView: View {
    let place: Place
    let activity: Activity?

    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var notes: String
    @State private var url: String
    @State private var locationName: String

    @State private var hasDate: Bool
    @State private var selectedDate: Date

    @State private var latitude: Double?
    @State private var longitude: Double?

    @State private var showPickOnMap = false

    init(place: Place, activity: Activity?) {
        self.place = place
        self.activity = activity

        _title = State(initialValue: activity?.title ?? "")
        _notes = State(initialValue: activity?.notes ?? "")
        _url = State(initialValue: activity?.url ?? "")
        _locationName = State(initialValue: activity?.locationName ?? "")

        _hasDate = State(initialValue: activity?.date != nil)
        _selectedDate = State(initialValue: activity?.date ?? Date())

        _latitude = State(initialValue: activity?.latitude)
        _longitude = State(initialValue: activity?.longitude)
    }

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func currentCoordinate() -> CLLocationCoordinate2D? {
        guard let latitude, let longitude else { return nil }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Activiteit") {
                    TextField("Titel", text: $title)

                    TextField("Locatie (optioneel)", text: $locationName)

                    TextField("Notities (optioneel)", text: $notes, axis: .vertical)
                        .lineLimit(3...6)

                    TextField("Link/URL (optioneel)", text: $url)

                    Toggle("Datum invullen (optioneel)", isOn: $hasDate)
                    if hasDate {
                        DatePicker("Datum", selection: $selectedDate, displayedComponents: .date)
                    }
                }

                Section("Locatiepin (optioneel)") {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Coördinaten")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            if let latitude, let longitude {
                                Text("\(latitude, specifier: "%.5f") , \(longitude, specifier: "%.5f")")
                                    .font(.footnote)
                            } else {
                                Text("Geen pin gekozen")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Button("Kies op kaart") {
                            showPickOnMap = true
                        }
                    }

                    if latitude != nil || longitude != nil {
                        Button(role: .destructive) {
                            latitude = nil
                            longitude = nil
                        } label: {
                            Label("Verwijder locatie", systemImage: "trash")
                        }
                    }
                }
            }
            .navigationTitle(activity == nil ? "Nieuwe activiteit" : "Bewerk activiteit")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Opslaan") {
                        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
                        let notesOrNil = notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : notes
                        let urlOrNil = url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : url
                        let locationOrNil = locationName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : locationName

                        if let activity {
                            activity.title = trimmedTitle
                            activity.notes = notesOrNil
                            activity.url = urlOrNil
                            activity.locationName = locationOrNil
                            activity.date = hasDate ? selectedDate : nil
                            activity.latitude = latitude
                            activity.longitude = longitude
                        } else {
                            let newActivity = Activity(
                                place: place,
                                title: trimmedTitle,
                                notes: notesOrNil,
                                url: urlOrNil,
                                locationName: locationOrNil,
                                date: hasDate ? selectedDate : nil,
                                latitude: latitude,
                                longitude: longitude
                            )
                            modelContext.insert(newActivity)
                        }

                        try? modelContext.save()
                        dismiss()
                    }
                    .disabled(!canSave)
                }
            }
        }
        .sheet(isPresented: $showPickOnMap) {
            MapPinPickView(
                initialCoordinate: currentCoordinate()
            ) { pickedCoordinate in
                latitude = pickedCoordinate.latitude
                longitude = pickedCoordinate.longitude
            }
        }
    }
}

